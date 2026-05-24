import { logger } from "../../../../../logger.js";
import { Workflow } from "./Workflow.js";
import { ConditionConfig } from "./ConditionConfig.js";
import { LoopConfig } from "./LoopConfig.js";
import { Node } from "./Node.js";
import { Scene } from "../../scenes/Scene.js";
import { Device } from "../../../../../model/devices/Device.js";
import { ActionRunnableEventBased, ActionRunnableEventBasedRunnable } from "../runnable/ActionRunnableEventBased.js";
import { TimeTrigger } from "./TimeTrigger.js";
import { ActionRunnableTimeBased, ActionRunnableTimeBasedRunnable } from "../runnable/ActionRunnableTimeBased.js";
import { DeviceTrigger } from "./DeviceTrigger.js";
import { ActionRunnableEnvironment } from "../runnable/ActionRunnableEnvironment.js";
import { ActionRunnableResponse } from "../runnable/ActionRunnableResponse.js";
import { ActionRunnableManualBased } from "../runnable/ActionRunnableManualBased.js";
import { EventManager } from "../../../../events/EventManager.js";
import { EventParameter } from "../../../../events/event-types/EventParameter.js";
import { EventType } from "../../../../events/event-types/EventType.js";
import { runWithSource, EventSource } from "../../../../events/EventSource.js";
import { VoiceAssistantTrigger, type VoiceAssistantCommandAction } from "./VoiceAssistantTrigger.js";
import { TriggerConfig } from "./TriggerConfig.js";
import {
  getDeviceMethodExact,
  invokeDeviceMethodOnDevice,
  stripParensBase,
} from "../../../utils/deviceMethodInvoke.js";
import { executeRoomCategoryAction } from "../../../utils/roomCategoryActionExecutor.js";
import {
  evaluateTimeCondition,
  getCurrentLocalMinutes,
  millisecondsUntilLocalTime,
} from "../../../utils/timeConditionEvaluate.js";
import type { ActionExecutionConditionComparison } from "../execution/actionExecution.js";
import type { ActionExecutionService } from "../execution/actionExecutionService.js";
import type { ActionExecutionInvocation } from "../execution/actionExecution.js";

/**
 * Im Workflow angegebener Funktionsname muss 1:1 dem Prototyp des Geräts entsprechen
 * (z. B. `setPowerOn`, `isPowerOn`). Optionaler Klammerteil `foo()` wird abgeschnitten.
 */

/**
 * Frontend liefert Parameter als `{ value, manual }`; ältere Daten können
 * EventParameter oder Rohwerte sein. Für Geräteaufrufe werden die
 * tatsächlichen Argumentwerte benötigt.
 */
function normalizeWorkflowArgValue(entry: unknown): unknown {
  if (entry === null || typeof entry !== "object") return entry;
  const o = entry as Record<string, unknown>;
  if ("manual" in o && "value" in o) return o.value;
  if ("value" in o && "name" in o && "id" in o) return o.value;
  return entry;
}

function normalizeWorkflowArgList(values: unknown[] | undefined): unknown[] {
  if (!values?.length) return [];
  return values.map(normalizeWorkflowArgValue);
}

/** Werte aus Wait-/Device-Trigger (Frontend ParameterValue) in EventParameter für Runnable-Events. */
function workflowTriggerValuesToEventParameters(raw?: unknown[]): EventParameter[] | undefined {
  if (!raw?.length) return undefined;
  return raw.map((entry, i) => {
    if (entry !== null && typeof entry === "object" && "manual" in entry && "value" in entry) {
      const v = (entry as { value: unknown }).value;
      return {
        id: i,
        name: `p${i}`,
        type: "str",
        value: v as string | number | boolean | string[] | number[] | boolean[],
      };
    }
    return entry as EventParameter;
  });
}

function voiceAssistantActionToButtonId(actionType: VoiceAssistantCommandAction | undefined): string {
  if (actionType === "pause") return "pause";
  if (actionType === "fortsetzen") return "continue";
  return "onoff";
}

/** Befehl (An) → Flow bei aktiv; Befehl (Aus/Stop) → Flow bei inaktiv. */
function resolveVoiceAssistantFlowFromActionType(
  actionType: VoiceAssistantCommandAction | undefined
): "on" | "off" {
  if (actionType === "aus" || actionType === "stop") return "off";
  return "on";
}

type DeviceMap = Map<string, Device>;
type SceneMap = Map<string, Scene>;

export type TriggerType = "manual" | "device" | "time" | "voice_assistant";

type NodeExecContext = { parallelGroupId?: string; executionMode?: "sequential" | "parallel" };

const EXECUTION_CANCELLED_MESSAGE = "Ausführung abgebrochen";

export class Action {
  private isExecuting = false;
  private cancelRequested = false;
  private pendingWaitAbort: (() => void) | null = null;
  private cancelAbortHandlers: Array<() => void> = [];
  private executionService?: ActionExecutionService;
  private actionNameResolver?: (actionId: string) => string | undefined;

  actionId!: string;
  name!: string;
  triggerType!: TriggerType;
  workflow!: Workflow;
  isActive: boolean = true;
  isAiSuggested: boolean = false;
  /**
   * Optionale, frei vom Nutzer gewählte Kategorie zum Gruppieren in der Übersicht.
   * Leerer String / undefined bedeutet "ohne Kategorie".
   */
  category?: string;
  aiDescription?: string;
  aiConfidence?: number;
  aiPatternType?: string;
  aiEvidenceCount?: number;
  createdAt!: string;
  updatedAt!: string;

  constructor(init?: Partial<Action>) {
    Object.assign(this, init);
    if( init?.workflow ){
      this.workflow = new Workflow(init.workflow);
    }
    this.category = Action.normalizeCategory(this.category);
  }

  setExecutionService(service: ActionExecutionService | undefined): void {
    this.executionService = service;
  }

  setActionNameResolver(resolver: ((actionId: string) => string | undefined) | undefined): void {
    this.actionNameResolver = resolver;
  }

  /** Bricht eine laufende Ausführung ab (Wait-Timer, Trigger-Warte und Workflow-Schleifen). */
  requestCancel(): void {
    this.cancelRequested = true;
    this.pendingWaitAbort?.();
    this.pendingWaitAbort = null;
    for (const handler of this.cancelAbortHandlers) {
      handler();
    }
    this.cancelAbortHandlers = [];
  }

  isExecutionRunning(): boolean {
    return this.isExecuting;
  }

  private registerCancelAbort(handler: () => void): void {
    this.cancelAbortHandlers.push(handler);
  }

  private resetCancelState(): void {
    this.cancelRequested = false;
    this.pendingWaitAbort = null;
    this.cancelAbortHandlers = [];
  }

  private cancelledResponse(environment: ActionRunnableEnvironment): ActionRunnableResponse {
    return {
      success: false,
      error: EXECUTION_CANCELLED_MESSAGE,
      environment,
    };
  }

  private checkCancelled(environment: ActionRunnableEnvironment): ActionRunnableResponse | null {
    if (!this.cancelRequested) return null;
    return this.cancelledResponse(environment);
  }

  private async cancellableDelay(ms: number): Promise<boolean> {
    if (this.cancelRequested || ms <= 0) {
      return !this.cancelRequested;
    }
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingWaitAbort = null;
        resolve(true);
      }, ms);
      this.pendingWaitAbort = () => {
        clearTimeout(timer);
        this.pendingWaitAbort = null;
        resolve(false);
      };
    });
  }

  private resolveActionDisplayName(actionId: string): string {
    const resolved = this.actionNameResolver?.(actionId)?.trim();
    return resolved && resolved.length > 0 ? resolved : actionId;
  }

  /**
   * Trim + leerer String → undefined, damit "ohne Kategorie" einheitlich bleibt
   * und Selektoren/Filter im Frontend nicht zwischen "" und undefined unterscheiden müssen.
   */
  static normalizeCategory(category: string | null | undefined): string | undefined {
    if (typeof category !== "string") return undefined;
    const trimmed = category.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  /** Nur persistierbare Felder — vermeidet Zirkelverweise bei JSON (API, DB). */
  toJSON(): Record<string, unknown> {
    return {
      actionId: this.actionId,
      name: this.name,
      triggerType: this.triggerType,
      workflow: this.workflow,
      isActive: this.isActive,
      isAiSuggested: this.isAiSuggested,
      category: this.category,
      aiDescription: this.aiDescription,
      aiConfidence: this.aiConfidence,
      aiPatternType: this.aiPatternType,
      aiEvidenceCount: this.aiEvidenceCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  public initActionRunnable(devices: DeviceMap, scenes: SceneMap, eventManager: EventManager): void {
    if( this.triggerType == "manual" ){
      const data:{runnable:ActionRunnableEventBasedRunnable} = this.createActionRunnableManualBasedRunnable(devices, scenes, eventManager);
      const runnable = new ActionRunnableManualBased(this.actionId, data.runnable);
      eventManager.addRunnable(runnable);
    } else if (this.triggerType === "device" || this.triggerType === "voice_assistant") {
      const eventTrigger =
        this.triggerType === "device"
          ? this.getTriggerEvent()
          : this.getVoiceAssistantTriggerAsDeviceTrigger(devices);
      if (!eventTrigger?.triggerDeviceId || !eventTrigger.triggerEvent) {
        logger.warn(
          { actionId: this.actionId, triggerType: this.triggerType },
          "Action-Trigger: Runnable nicht registriert (triggerDeviceId oder triggerEvent fehlt)"
        );
        return;
      }
      const run: ActionRunnableEventBasedRunnable = async environment => {
        return await this.executeWorkflow(devices, scenes, eventManager, environment);
      };
      eventManager.addRunnable(new ActionRunnableEventBased(this.actionId, this.actionId, run, eventTrigger));
    } else {
      const data:{timeTrigger:TimeTrigger | null, runnable:ActionRunnableTimeBasedRunnable} = this.createActionRunnableTimeBasedRunnable(devices, scenes, eventManager);
      if(!data.timeTrigger) return;
      const runnable = new ActionRunnableTimeBased(this.actionId, data.runnable, data.timeTrigger);
      eventManager.addRunnable(runnable);
      runnable.start();
    }
  }

  private createActionRunnableManualBasedRunnable(devices: DeviceMap, scenes: SceneMap, eventManager: EventManager):{runnable:ActionRunnableEventBasedRunnable} {
    const runnable = async (environment:ActionRunnableEnvironment) => {
      return await this.executeWorkflow(devices, scenes, eventManager, environment);
    };
    return {runnable};
  }

  private createActionRunnableTimeBasedRunnable(devices: DeviceMap, scenes: SceneMap, eventManager: EventManager):{timeTrigger:TimeTrigger | null, runnable:ActionRunnableTimeBasedRunnable} {
    const timeTrigger = this.getTriggerTime();
    const runnable = async () => {
      const environment = {environment:new Map<string, unknown>()};
      return await this.executeWorkflow(devices, scenes, eventManager, environment);
    };
    return {timeTrigger, runnable};
  }

  private getVoiceAssistantTriggerAsDeviceTrigger(devices?: DeviceMap): DeviceTrigger | null {
    const startNode = this.resolveStartNode(this.workflow);
    if (startNode.triggerConfig?.type !== "voice_assistant") {
      return null;
    }
    const va = startNode.triggerConfig?.voiceAssistant;
    if (!va?.deviceId) {
      return null;
    }
    const flow = resolveVoiceAssistantFlowFromActionType(va.actionType);
    const triggerEvent: EventType = flow === "off" ? EventType.ACTIVE_INACTIVE : EventType.ACTIVE;
    return new DeviceTrigger({
      triggerDeviceId: va.deviceId,
      triggerModuleId: "voice-assistant",
      triggerEvent,
    });
  }


  public getVoiceAssistantTriggerDeviceId(): string | null {
    const startNode = this.resolveStartNode(this.workflow);
    if( startNode.triggerConfig?.type !== "voice_assistant") return "";
    return startNode.triggerConfig?.voiceAssistant?.deviceId ?? "";
  }

  getVoiceAssistantTriggerKeyword(): string {
    const startNode = this.resolveStartNode(this.workflow);
    if( startNode.triggerConfig?.type !== "voice_assistant") return "";
    return startNode.triggerConfig?.voiceAssistant?.keyword ?? "";
  }

  getVoiceAssistantTriggerActionType(): VoiceAssistantCommandAction {
    const startNode = this.resolveStartNode(this.workflow);
    if( startNode.triggerConfig?.type !== "voice_assistant") return "an";
    return startNode.triggerConfig?.voiceAssistant?.actionType ?? "an";
  }

  setVoiceAssistantTriggerData(data: VoiceAssistantTrigger) {
    this.triggerType = "voice_assistant";
    const startNode = this.resolveStartNode(this.workflow);
    startNode.triggerConfig = new TriggerConfig({
      type: "voice_assistant",
      voiceAssistant: data
    });
  }

  /**
   * Nachträgliche Änderung von An/Aus (Sprachbefehl + Flow-Trigger: aktiv vs. inaktiv).
   * Erwartet `triggerType === "voice_assistant"` und passenden Startknoten.
   */
  public patchVoiceAssistantCommandAction(commandAction: VoiceAssistantCommandAction): boolean {
    if (this.triggerType !== "voice_assistant") {
      return false;
    }
    const startNode = this.resolveStartNode(this.workflow);
    const tc = startNode?.triggerConfig;
    if (tc?.type !== "voice_assistant" || !tc.voiceAssistant) {
      return false;
    }
    tc.voiceAssistant.actionType = commandAction;
    this.updatedAt = new Date().toISOString();
    return true;
  }

  private getTriggerEvent(): DeviceTrigger | null {
    const startNode = this.resolveStartNode(this.workflow);
    if (startNode.triggerConfig?.type === "device") {
      const d = startNode.triggerConfig?.device;
      if (!d) return null;
      return new DeviceTrigger({
        ...d,
        triggerValues: workflowTriggerValuesToEventParameters(d.triggerValues as unknown[] | undefined),
      });
    }
    return null;
  }

  private getTriggerTime():TimeTrigger | null{
    const startNode = this.resolveStartNode(this.workflow);
    if( startNode.triggerConfig?.type == "time"){
      return startNode.triggerConfig?.time ?? null;
    } 
    return null;
  }

  /**
   * Führt den Workflow direkt aus (z. B. Test aus der UI), ohne den registrierten Trigger (Gerät/Zeit/Sprache).
   */
  runWorkflowIgnoringTrigger(
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager
  ): Promise<ActionRunnableResponse> {
    return this.executeWorkflow(devices, scenes, eventManager, {
      environment: new Map<string, unknown>()
    });
  }

  private async executeWorkflow(
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment
  ): Promise<ActionRunnableResponse> {
    const execSvc = this.executionService;
    const ownsExecution = Boolean(execSvc && !environment.executionId);
    if (ownsExecution && execSvc) {
      const trigger = environment.parentExecutionId ? "nested" : undefined;
      const eid = execSvc.beginExecution(
        this,
        trigger,
        environment.parentExecutionId
      );
      if (eid) environment.executionId = eid;
    }

    const finishExecution = (response: ActionRunnableResponse) => {
      if (ownsExecution && execSvc) {
        execSvc.finalize(this.actionId, response);
      }
      return response;
    };

    if (this.isExecuting) {
      const response: ActionRunnableResponse = {
        success: true,
        warning: "Action wird bereits ausgefuehrt - Trigger ignoriert",
        environment: environment
      };
      return finishExecution(response);
    }
    this.isExecuting = true;

    try {
      if (!this.workflow?.nodes || this.workflow.nodes.length <= 1) {
        logger.warn({ actionId: this.actionId }, "executeWorkflow: Kein ausführbarer Workflow (zu wenige Knoten)");
        return finishExecution({
          success: true,
          warning: "Kein ausführbarer Workflow (zu wenige Knoten)",
          environment: environment
        });
      }

      const startNode = this.resolveStartNode(this.workflow);
      if (!startNode) {
        logger.warn({ actionId: this.actionId }, "executeWorkflow: Kein Startknoten");
        return finishExecution({
          success: false,
          error: "Kein Startknoten fuer Action gefunden, obwohl mehrere Nodes vorhanden sind",
          environment: environment
        });
      }

      const result = await this.executeNode(startNode, devices, scenes, eventManager, environment);
      return finishExecution(result);
    } catch (error) {
      return finishExecution({
        success: false,
        error: error instanceof Error ? error.message : String(error ?? "Unbekannter Fehler"),
        environment: environment
      });
    } finally {
      this.isExecuting = false;
      this.resetCancelState();
    }
  }

  private async executeNode(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment,
    execContext?: NodeExecContext
  ): Promise<ActionRunnableResponse> {
    if (!node) return {
      success: false,
      error: "Node ist leer",
      environment: environment
    };
    const cancelled = this.checkCancelled(environment);
    if (cancelled) return cancelled;
    const nodeType = node.type;
    if (!nodeType) {
      return {
        success: false,
        error: `Node ${node.name} hat keinen Typ`,
        environment: environment
      };
    }

    this.executionService?.recordNodeStart(this.actionId, node, execContext);

    let result: ActionRunnableResponse;
    try {
      switch (nodeType) {
        case "trigger":
          result = await this.executeNextNodes(node, devices, scenes, eventManager, environment);
          break;
        case "action":
          result = await this.executeActionNode(node, devices, scenes, eventManager, environment);
          break;
        case "condition":
          result = await this.executeConditionNode(node, devices, scenes, eventManager, environment);
          break;
        case "wait":
          result = await this.executeWaitNode(node, devices, scenes, eventManager, environment);
          break;
        case "loop":
          result = await this.executeLoopNode(node, devices, scenes, eventManager, environment);
          break;
        case "variable":
          result = await this.executeVariableNode(node, devices, scenes, eventManager, environment);
          break;
        default:
          result = {
            success: false,
            error: `Node ${node.name} hat einen unbekannten Typ: ${nodeType}`,
            environment: environment
          };
      }
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : String(error ?? "Unbekannter Fehler"),
        environment: environment
      };
    }

    this.executionService?.recordNodeEnd(this.actionId, result);
    return result;
  }

  private recordInvocation(invocation: ActionExecutionInvocation): void {
    this.executionService?.recordInvocation(this.actionId, invocation);
  }

  private async executeActionNode(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment
  ):Promise<ActionRunnableResponse> {
    let result: ActionRunnableResponse = {success: true, environment: environment};
    const actionConfig = node.actionConfig;
    if (!actionConfig) {
      result = {success: result.success, warning: `Action-Node ${node.name} hat keine ActionConfig`, environment: result.environment};
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }

    const actionType = actionConfig.type;

    if (actionType === "device") {
      const deviceId = actionConfig.deviceId;
      if (!deviceId) {
        result = {success: result.success, warning: `Device-Action in Node ${node.name} hat keine deviceId`, environment: result.environment};
        return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
      }
      const device = this.getWorkflowDevice(deviceId, devices);
      if (!device) {
        result = {success: result.success, warning: `Device nicht gefunden fuer Action-Node ${node.name}`, environment: result.environment};
        return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
      }
      const steps = actionConfig.steps ?? [];
      const baseNodeKey =
        (node.nodeId && String(node.nodeId).trim() !== "") ? String(node.nodeId) : "";
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepAction = step?.action;
        if (!stepAction) continue;
        const stepValues = normalizeWorkflowArgList((step.values ?? []) as unknown[]);
        let methodOut: unknown;
        try {
          methodOut = await this.invokeDeviceMethod(device, stepAction, stepValues);
          this.recordInvocation({
            kind: "device",
            label: stripParensBase(stepAction),
            args: stepValues,
            result: methodOut,
            target: {
              deviceId,
              deviceName: device.name ?? deviceId,
              method: stepAction,
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.recordInvocation({
            kind: "device",
            label: stripParensBase(stepAction),
            args: stepValues,
            error: msg,
            target: {
              deviceId,
              deviceName: device.name ?? deviceId,
              method: stepAction,
            },
          });
          throw err;
        }
        if (methodOut !== undefined && methodOut !== null) {
          const envKey = baseNodeKey
            ? `${baseNodeKey}:step${i}`
            : `device:${deviceId}:${stripParensBase(stepAction)}`;
          result.environment.environment.set(envKey, methodOut);
        }
      }
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    } else if (actionType === "action") {
      const nestedActionId = (actionConfig.actionId ?? "").trim();
      if (!nestedActionId || !eventManager.hasRunnable(nestedActionId)) {
        result = {
          success: result.success,
          warning: `Action ${nestedActionId || "(leer)"} nicht gefunden fuer Action-Node ${node.name}`,
          environment: result.environment,
        };
      } else {
        const nested = eventManager.getRunnable(nestedActionId);
        if (nested?.type === "manual") {
          const nestedEnv: ActionRunnableEnvironment = {
            environment: result.environment.environment,
            parentExecutionId: environment.executionId,
          };
          result = await (nested as ActionRunnableManualBased).run(nestedEnv);
          const nestedName = this.resolveActionDisplayName(nestedActionId);
          this.recordInvocation({
            kind: "nested_action",
            label: nestedName,
            nestedExecutionId: nestedEnv.executionId,
            result: result.success,
            error: result.error,
            target: {
              actionId: nestedActionId,
              actionName: nestedName,
            },
          });
          if (!result.success) {
            return result;
          }
        } else {
          result = {
            success: result.success,
            warning: `Es können nur manuelle Aktionen aufgerufen werden. Action-Node ${node.name} hat einen anderen Action-Typ: ${nested?.type}`,
            environment: result.environment,
          };
        }
      }
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    } else if (actionType === "room") {
      const roomWarnings = await executeRoomCategoryAction(actionConfig, devices);
      const roomId = actionConfig.roomId?.trim() || undefined;
      const roomCategory = actionConfig.roomCategory?.trim() || undefined;
      const roomCommand = actionConfig.roomCommand?.trim() || undefined;
      this.recordInvocation({
        kind: "room",
        label: roomCategory ?? roomId ?? "room",
        args: [roomCommand ?? roomCategory],
        result: roomWarnings.length === 0 ? true : roomWarnings,
        target: {
          roomId,
          roomCategory,
          roomCommand,
        },
      });
      if (roomWarnings.length > 0) {
        result = {
          success: result.success,
          warning: roomWarnings.join("; "),
          environment: result.environment,
        };
      }
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    } else {
      return {success: false, error: `Unbekannter Action-Typ fuer Node ${node.name}`, environment: result.environment};
    }

  }

  private async invokeDeviceMethod(device: Device, methodName: string, values: unknown[]): Promise<unknown> {
    const source = this.isAiSuggested ? EventSource.AUTOMATION : EventSource.SYSTEM;
    const raw = runWithSource(source, () => this.invokeDeviceMethodInner(device, methodName, values));
    if (raw instanceof Promise) {
      return await raw;
    }
    return raw;
  }

  private invokeDeviceMethodInner(device: Device, methodName: string, values: unknown[]): unknown {
    try {
      const baseMethodName = stripParensBase(methodName);
      const normalized = normalizeWorkflowArgList(values);
      if (!getDeviceMethodExact(device, methodName)) {
        logger.warn(
          { actionId: this.actionId, methodName: baseMethodName, deviceId: device.id },
          "Methode nicht gefunden: exakter Funktionsname wie am Geraet erforderlich"
        );
        return;
      }
      return invokeDeviceMethodOnDevice(device, methodName, normalized);
    } catch (err) {
      logger.error(
        { err, methodName, deviceId: device.id },
        "Fehler beim Aufrufen der Methode auf Device"
      );
    }
  }

  private convertValue(value: unknown) {
    if (typeof value === "string") {
      if (value === "true") return true;
      if (value === "false") return false;
      if (!Number.isNaN(Number(value))) return Number(value);
    }
    return value;
  }

  private async executeConditionNode(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment
  ):Promise<ActionRunnableResponse>  {
    let result: ActionRunnableResponse = {success: true, environment: environment};
    const conditionConfig = node.conditionConfig;
    if (!conditionConfig) {
      result = {success: result.success, warning: `Condition-Node ${node.name} hat keine ConditionConfig`, environment: result.environment};
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }
    const evaluated = this.evaluateConditionWithDetails(conditionConfig, devices, environment);
    this.recordInvocation({
      kind: "condition_branch",
      label: evaluated.result ? "true" : "false",
      comparison: evaluated.comparison,
    });
    const conditionResult = evaluated.result;
    const nextNodes = conditionResult ? node.trueNodes : node.falseNodes;
    if (nextNodes && nextNodes.length) {
      for (const nextNodeId of nextNodes) {
        const nextNode = this.findNodeById(this.workflow?.nodes, nextNodeId);
        if (nextNode) {
          result = await this.executeNode(nextNode, devices, scenes, eventManager, result.environment);
          if(!result.success) {
            return result;
          }
        }
      }
    }
    return result;
  }

  /**
   * Setzt einen Variablenwert in der Workflow-Environment unter dem Key `var:NAME`.
   * Mehrere Variable-Nodes mit dem gleichen Namen ueberschreiben den Wert deterministisch
   * gemaess der Ausfuehrungsreihenfolge.
   */
  private async executeVariableNode(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment
  ): Promise<ActionRunnableResponse> {
    let result: ActionRunnableResponse = { success: true, environment: environment };
    const variableConfig = node.variableConfig;
    if (!variableConfig) {
      result = {
        success: result.success,
        warning: `Variable-Node ${node.name} hat keine VariableConfig`,
        environment: result.environment
      };
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }
    const name = (variableConfig.name ?? "").trim();
    if (!name) {
      result = {
        success: result.success,
        warning: `Variable-Node ${node.name} hat keinen Variablen-Namen`,
        environment: result.environment
      };
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }
    const usesDeviceSource = this.variableConfigUsesDeviceSource(variableConfig);
    let value: string;
    let deviceComparison: ActionExecutionConditionComparison | undefined;

    if (usesDeviceSource) {
      const deviceId = (variableConfig.deviceId ?? "").trim();
      const property = (variableConfig.property ?? "").trim();
      if (!deviceId || !property) {
        value = "false";
        result = {
          ...result,
          warning: `Variable-Node ${node.name}: Gerät oder boolesche Funktion fehlt`,
        };
      } else {
        const deviceEval = this.evaluateConditionWithDetails(
          new ConditionConfig({
            source: "device",
            deviceId: variableConfig.deviceId,
            moduleId: variableConfig.moduleId,
            property: variableConfig.property,
            values: variableConfig.values,
          }),
          devices,
          environment
        );
        value = deviceEval.result ? "true" : "false";
        deviceComparison = deviceEval.comparison;
      }
    } else {
      value = String(variableConfig.value ?? "");
    }

    result.environment.environment.set(`var:${name}`, value);
    this.recordInvocation({
      kind: "variable",
      label: name,
      args: [value],
      result: value,
      comparison: deviceComparison,
    });
    return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
  }

  /** Manuell oder boolesche Geraetefunktion (valueSource oder deviceId+property). */
  private variableConfigUsesDeviceSource(variableConfig: {
    valueSource?: string;
    deviceId?: string;
    property?: string;
  }): boolean {
    if (variableConfig.valueSource === "device") {
      return true;
    }
    const deviceId = (variableConfig.deviceId ?? "").trim();
    const property = (variableConfig.property ?? "").trim();
    return deviceId.length > 0 && property.length > 0;
  }

  private formatLocalTimeFromMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  private evaluateCondition(
    conditionConfig: ConditionConfig,
    devices: DeviceMap,
    environment?: ActionRunnableEnvironment
  ): boolean {
    return this.evaluateConditionWithDetails(conditionConfig, devices, environment).result;
  }

  private evaluateConditionWithDetails(
    conditionConfig: ConditionConfig,
    devices: DeviceMap,
    environment?: ActionRunnableEnvironment
  ): { result: boolean; comparison: ActionExecutionConditionComparison } {
    if (conditionConfig.source === "time") {
      const target = conditionConfig.compareLiteral != null
        ? String(conditionConfig.compareLiteral)
        : undefined;
      const operator = conditionConfig.operator ?? "equals";
      const nowMinutes = getCurrentLocalMinutes();
      const currentTime = this.formatLocalTimeFromMinutes(nowMinutes);
      const result = evaluateTimeCondition(operator, target);
      return {
        result,
        comparison: {
          source: "time",
          operator,
          left: currentTime,
          right: target ?? "",
          leftDescription: "Aktuelle Uhrzeit",
          rightDescription: "Ziel-Uhrzeit",
        },
      };
    }

    if (conditionConfig.source === "variable") {
      const env = environment?.environment;
      const leftName = (conditionConfig.variableName ?? "").trim();
      const left = env && leftName ? String(env.get(`var:${leftName}`) ?? "") : "";
      const compareSource = conditionConfig.compareSource ?? "literal";
      const operator = conditionConfig.operator ?? "equals";
      let right: string;
      let rightDescription: string;
      if (compareSource === "variable") {
        const rightName = (conditionConfig.compareVariableName ?? "").trim();
        right = env && rightName ? String(env.get(`var:${rightName}`) ?? "") : "";
        rightDescription = rightName ? `Variable "${rightName}"` : "Variable";
      } else {
        right = String(conditionConfig.compareLiteral ?? "");
        rightDescription = "Literal";
      }
      const result = operator === "notEquals" ? left !== right : left === right;
      return {
        result,
        comparison: {
          source: "variable",
          operator,
          left,
          right,
          leftDescription: leftName ? `Variable "${leftName}"` : "Variable",
          rightDescription,
        },
      };
    }

    const deviceId = conditionConfig.deviceId;
    const property = conditionConfig.property ?? "";
    const values = normalizeWorkflowArgList((conditionConfig.values ?? []) as unknown[]);
    const device = deviceId ? this.getWorkflowDevice(deviceId, devices) : null;
    const deviceLabel = device?.name ?? deviceId ?? "Gerät";

    if (!deviceId || !property) {
      return {
        result: false,
        comparison: {
          source: "device",
          leftDescription: `${deviceLabel}.${property || "?"}`,
          left: false,
        },
      };
    }
    if (!device) {
      return {
        result: false,
        comparison: {
          source: "device",
          leftDescription: `${deviceLabel}.${property}`,
          left: false,
          rightDescription: "Gerät nicht gefunden",
        },
      };
    }
    const resolved = getDeviceMethodExact(device, property);
    if (!resolved) {
      return {
        result: false,
        comparison: {
          source: "device",
          leftDescription: `${deviceLabel}.${property}`,
          left: false,
          rightDescription: "Methode nicht gefunden",
        },
      };
    }
    const fn = resolved.fn;
    const callLabel =
      values.length > 0
        ? `${deviceLabel}.${stripParensBase(property)}(${values.map(v => JSON.stringify(v)).join(", ")})`
        : `${deviceLabel}.${stripParensBase(property)}()`;

    let rawResult: unknown;
    if (!values || values.length === 0) {
      rawResult = fn.call(device);
    } else if (values.length === 1) {
      rawResult = fn.call(device, this.convertValue(values[0]));
    } else {
      rawResult = fn.call(device, this.convertValue(values[0]), this.convertValue(values[1]));
    }
    const result = Boolean(rawResult);
    return {
      result,
      comparison: {
        source: "device",
        operator: "truthy",
        left: rawResult,
        leftDescription: callLabel,
        rightDescription: "Erwartet: wahr",
      },
    };
  }

  private async executeWaitNode(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment
  ):Promise<ActionRunnableResponse>  {
    let result: ActionRunnableResponse = {success: true, environment: environment};
    const waitConfig = node.waitConfig;
    if (!waitConfig) {
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }

    if (waitConfig.type === "time") {
      const waitTime = waitConfig.waitTime ?? 0;
      this.recordInvocation({ kind: "wait", label: "time", args: [waitTime] });
      if (waitTime > 0) {
        const completed = await this.cancellableDelay(waitTime * 1000);
        if (!completed) {
          return this.cancelledResponse(result.environment);
        }
      }
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }

    if (waitConfig.type === "untilTime") {
      const untilLabel =
        waitConfig.waitUntilTime != null ? String(waitConfig.waitUntilTime) : "";
      this.recordInvocation({ kind: "wait", label: "untilTime", args: [untilLabel] });
      const ms = millisecondsUntilLocalTime(
        waitConfig.waitUntilTime != null ? String(waitConfig.waitUntilTime) : undefined
      );
      if (ms !== null && ms > 0) {
        const completed = await this.cancellableDelay(ms);
        if (!completed) {
          return this.cancelledResponse(result.environment);
        }
      } else if (ms === null) {
        result = {
          success: result.success,
          warning: `Wait-Node ${node.name}: ungueltige Ziel-Uhrzeit`,
          environment: result.environment,
        };
      }
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }

    if (waitConfig.type === "trigger") {
      this.recordInvocation({
        kind: "wait",
        label: "trigger",
        args: [waitConfig.deviceId, waitConfig.triggerEvent, waitConfig.timeout],
      });
      const deviceId = waitConfig.deviceId;
      const triggerEvent = waitConfig.triggerEvent;
      const triggerValues = workflowTriggerValuesToEventParameters(
        waitConfig.triggerValues as unknown[] | undefined
      );
      if (!deviceId || !triggerEvent) {
        return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
      }
      const device = this.getWorkflowDevice(deviceId, devices);
      if (!device) {
        return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
      }

      const subActionId = `${this.actionId ?? "action"}-wait-${node.nodeId ?? "node"}`;
      const eventTrigger = new DeviceTrigger({
        triggerDeviceId: deviceId,
        triggerModuleId: device.moduleId,
        triggerEvent: triggerEvent,
        triggerValues: triggerValues,
      });

      const completionPromise = new Promise<Promise<ActionRunnableResponse>>((resolve) => {
        let timeout: NodeJS.Timeout | null = null;
        let completed = false;
        const complete = (res: Promise<ActionRunnableResponse>) => {
          if (completed) return;
          completed = true;
          eventManager.removeRunnable(actionRunnable);
          if (timeout) clearTimeout(timeout);
          resolve(res);
        };
        const runnable = async (env: ActionRunnableEnvironment) => {
          const res = this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
          complete(res);
          return await res;
        };
        const actionRunnable = new ActionRunnableEventBased(subActionId, this.actionId, runnable, eventTrigger);
        eventManager.addRunnable(actionRunnable);

        this.registerCancelAbort(() => {
          if (completed) return;
          complete(Promise.resolve(this.cancelledResponse(result.environment)));
        });

        if (waitConfig.timeout && waitConfig.timeout > 0) {
          timeout = setTimeout(async () => {
            if (!completed) {
              const res = this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
              complete(res);
            }
          }, waitConfig.timeout * 1000);
        }
      });

      return await completionPromise;
    }

    return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
  }

  private async executeLoopNode(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment
  ):Promise<ActionRunnableResponse>  {
    let result: ActionRunnableResponse = {success: true, environment: environment};
    const loopConfig = node.loopConfig as LoopConfig | undefined;
    if (!loopConfig) {
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }
    const loopNodes = node.loopNodes ?? [];
    if (!loopNodes.length) {
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }

    if (loopConfig.type === "for") {
      const count = loopConfig.count ?? 0;
      for (let i = 0; i < count; i += 1) {
        const cancelled = this.checkCancelled(result.environment);
        if (cancelled) return cancelled;
        const groupId = `loop:${node.nodeId ?? node.name}:iter:${i}`;
        for (const loopNodeId of loopNodes) {
          const loopNode = this.findNodeById(this.workflow?.nodes, loopNodeId);
          if (loopNode) {
            result = await this.executeNode(
              loopNode,
              devices,
              scenes,
              eventManager,
              result.environment,
              { parallelGroupId: groupId }
            );
            if(!result.success) {
              return result;
            }
          }
        }
      }
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }

    if (loopConfig.type === "while") {
      const condition = loopConfig.condition;
      const maxIterations = loopConfig.maxIterations ?? 0;
      let iteration = 0;
      while (true) {
        iteration += 1;
        const cancelled = this.checkCancelled(result.environment);
        if (cancelled) return cancelled;
        if (maxIterations > 0 && iteration > maxIterations) {
          break;
        }
        const conditionResult = condition ? this.evaluateCondition(condition, devices, result.environment) : false;
        if (!conditionResult) break;
        const groupId = `loop:${node.nodeId ?? node.name}:iter:${iteration}`;
        for (const loopNodeId of loopNodes) {
          const loopNode = this.findNodeById(this.workflow?.nodes, loopNodeId);
          if (loopNode) {
            result = await this.executeNode(
              loopNode,
              devices,
              scenes,
              eventManager,
              result.environment,
              { parallelGroupId: groupId }
            );
            if(!result.success) {
              return result;
            }
          }
        }
      }
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }

    return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
  }

  private async executeNextNodes(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment
  ):Promise<ActionRunnableResponse>  {
    let result: ActionRunnableResponse = {success: true, environment: environment};
    const nextNodes = node.nextNodes ?? [];
    for (const nextNodeId of nextNodes) {
      const cancelled = this.checkCancelled(result.environment);
      if (cancelled) return cancelled;
      const nextNode = this.findNodeById(this.workflow?.nodes, nextNodeId);
      if (nextNode) {
        result = await this.executeNode(nextNode, devices, scenes, eventManager, result.environment);
        if(!result.success) {
          return result;
        } 
      }
    }
    return result;
  }

  private getWorkflowDevice(deviceId: string | undefined, devices: DeviceMap | undefined): Device | null {
    if (!deviceId || !devices) {
      return null;
    }
    return devices.get(deviceId) ?? null;
  }

  private resolveStartNode(workflow: Workflow) {
    const nodes = workflow.nodes ?? [];
    const startNodeId = workflow.startNodeId;
    if (startNodeId) {
      const node = this.findNodeById(nodes, startNodeId);
      if (node) return node;
    }
    const triggerNode = (workflow as any).triggerNode as Node | undefined;
    if (triggerNode) return triggerNode;
    const trigger = nodes.find(node => node.type === "trigger");
    if (trigger) return trigger;
    return nodes[0];
  }

  private findNodeById(nodes: Node[] | undefined, nodeId: string | undefined) {
    if (!nodes || !nodeId) return null;
    return nodes.find(node => node.nodeId === nodeId) ?? null;
  }

  getTriggerType() {
    return this.triggerType;
  }
}
