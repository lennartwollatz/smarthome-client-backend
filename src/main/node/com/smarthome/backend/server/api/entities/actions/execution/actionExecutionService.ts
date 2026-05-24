import type { Action } from "../action/Action.js";
import type { Node } from "../action/Node.js";
import type { ActionRunnableResponse } from "../runnable/ActionRunnableResponse.js";
import type { LiveUpdateService } from "../../../services/live.service.js";
import { ActionExecutionStore } from "../../../../db/actionExecutionStore.js";
import type {
  ActionExecution,
  ActionExecutionInvocation,
  ActionExecutionStep,
  ActionExecutionTrigger,
} from "./actionExecution.js";

type ActiveRun = {
  execution: ActionExecution;
  /** Stack wegen rekursiver executeNode-Aufrufe (trigger → variable → …). */
  openStepStack: number[];
};

export class ActionExecutionService {
  private liveUpdateService?: LiveUpdateService;
  private readonly activeByActionId = new Map<string, ActiveRun>();
  private triggerOverride = new Map<string, ActionExecutionTrigger>();

  constructor(private readonly store: ActionExecutionStore) {}

  setLiveUpdateService(service: LiveUpdateService): void {
    this.liveUpdateService = service;
  }

  getExecutions(): ActionExecution[] {
    return this.store.findRecent();
  }

  getExecution(executionId: string): ActionExecution | null {
    return this.store.findById(executionId);
  }

  /** Temporärer Trigger für den nächsten Lauf einer Action (run-now, Szene). */
  setTriggerOverride(actionId: string, trigger: ActionExecutionTrigger): void {
    this.triggerOverride.set(actionId, trigger);
  }

  clearTriggerOverride(actionId: string): void {
    this.triggerOverride.delete(actionId);
  }

  resolveTrigger(action: Action): ActionExecutionTrigger {
    const override = this.triggerOverride.get(action.actionId);
    if (override) return override;
    const t = action.triggerType;
    if (t === "voice_assistant") return "voice_assistant";
    if (t === "device" || t === "time" || t === "manual") return t;
    return "manual";
  }

  beginExecution(
    action: Action,
    trigger?: ActionExecutionTrigger,
    parentExecutionId?: string
  ): string | null {
    const resolvedTrigger = trigger ?? this.resolveTrigger(action);
    const execution = this.store.createSkeleton(
      action.actionId,
      action.name ?? action.actionId,
      resolvedTrigger,
      parentExecutionId
    );
    this.store.save(execution);
    this.activeByActionId.set(action.actionId, { execution, openStepStack: [] });
    this.emit(execution);
    return execution.executionId;
  }

  getActiveExecutionId(actionId: string): string | null {
    return this.activeByActionId.get(actionId)?.execution.executionId ?? null;
  }

  getActiveExecutions(): ActionExecution[] {
    return Array.from(this.activeByActionId.values()).map((active) => active.execution);
  }

  findActiveActionIdByExecutionId(executionId: string): string | null {
    for (const [actionId, active] of this.activeByActionId) {
      if (active.execution.executionId === executionId) {
        return actionId;
      }
    }
    return null;
  }

  recordNodeStart(
    actionId: string,
    node: Node,
    opts?: { parallelGroupId?: string; executionMode?: "sequential" | "parallel" }
  ): void {
    const active = this.activeByActionId.get(actionId);
    if (!active) return;

    const stepIndex = active.execution.steps.length;
    const step: ActionExecutionStep = {
      stepIndex,
      nodeId: node.nodeId,
      nodeName: node.name,
      nodeType: node.type ?? "unknown",
      executionMode: opts?.executionMode ?? "sequential",
      parallelGroupId: opts?.parallelGroupId,
      startedAt: new Date().toISOString(),
      status: "running",
      invocations: [],
    };
    active.execution.steps.push(step);
    active.openStepStack.push(stepIndex);
    this.persistAndEmit(active.execution);
  }

  private currentOpenStepIndex(active: ActiveRun): number | undefined {
    if (active.openStepStack.length === 0) return undefined;
    return active.openStepStack[active.openStepStack.length - 1];
  }

  recordInvocation(actionId: string, invocation: ActionExecutionInvocation): void {
    const active = this.activeByActionId.get(actionId);
    const stepIndex = active ? this.currentOpenStepIndex(active) : undefined;
    if (!active || stepIndex === undefined) return;
    const step = active.execution.steps[stepIndex];
    if (!step) return;
    if (!step.invocations) step.invocations = [];
    step.invocations.push(invocation);
    this.persistAndEmit(active.execution);
  }

  recordNodeEnd(actionId: string, response: ActionRunnableResponse): void {
    const active = this.activeByActionId.get(actionId);
    if (!active || active.openStepStack.length === 0) return;
    const stepIndex = active.openStepStack.pop();
    if (stepIndex === undefined) return;
    const step = active.execution.steps[stepIndex];
    if (!step) return;

    step.finishedAt = new Date().toISOString();
    if (!response.success) {
      step.status = "failed";
      step.error = response.error;
    } else if (response.warning) {
      step.status = "completed";
      step.warning = response.warning;
    } else {
      step.status = "completed";
    }
    this.persistAndEmit(active.execution);
  }

  /** Schließt alle noch offenen Schritte (z. B. nach Abbruch oder Stack-Inkonsistenz). */
  private closeOpenSteps(active: ActiveRun, finishedAt: string, failed: boolean): void {
    while (active.openStepStack.length > 0) {
      const stepIndex = active.openStepStack.pop();
      if (stepIndex === undefined) continue;
      const step = active.execution.steps[stepIndex];
      if (!step || step.status !== "running") continue;
      step.finishedAt = finishedAt;
      step.status = failed ? "failed" : "completed";
    }
  }

  appendWarning(actionId: string, warning: string): void {
    const active = this.activeByActionId.get(actionId);
    if (!active) return;
    active.execution.warning = active.execution.warning
      ? `${active.execution.warning}; ${warning}`
      : warning;
    this.persistAndEmit(active.execution);
  }

  finalize(actionId: string, response: ActionRunnableResponse): void {
    const active = this.activeByActionId.get(actionId);
    if (!active) return;

    const execution = active.execution;
    execution.finishedAt = new Date().toISOString();
    this.closeOpenSteps(active, execution.finishedAt, !response.success);
    execution.success = response.success;
    if (response.error) execution.error = response.error;
    if (response.warning) {
      execution.warning = execution.warning
        ? `${execution.warning}; ${response.warning}`
        : response.warning;
    }
    execution.status = response.success ? "completed" : "failed";
    if (!response.success && !execution.error) {
      execution.error = response.error ?? "Ausführung fehlgeschlagen";
    }

    this.store.save(execution);
    this.emit(execution);
    this.activeByActionId.delete(actionId);
  }

  cancelActive(actionId: string): void {
    this.activeByActionId.delete(actionId);
  }

  isExecutionActive(executionId: string): boolean {
    return this.findActiveActionIdByExecutionId(executionId) != null;
  }

  private persistAndEmit(execution: ActionExecution): void {
    this.store.save(execution);
    this.emit(execution);
  }

  private emit(execution: ActionExecution): void {
    this.liveUpdateService?.emit("actionExecution:updated", execution);
  }
}
