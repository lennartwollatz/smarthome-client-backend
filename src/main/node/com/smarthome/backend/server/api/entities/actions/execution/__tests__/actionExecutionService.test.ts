import { describe, expect, it, vi } from "vitest";
import { ActionExecutionService } from "../actionExecutionService.js";
import type { Action } from "../../action/Action.js";
import type { ActionExecution } from "../actionExecution.js";
import type { Node } from "../../action/Node.js";

class InMemoryExecutionStore {
  private data = new Map<string, ActionExecution>();

  createSkeleton(
    actionId: string,
    actionName: string,
    trigger: ActionExecution["trigger"],
    parentExecutionId?: string
  ): ActionExecution {
    return {
      executionId: `exec-${this.data.size + 1}`,
      actionId,
      actionName,
      trigger,
      status: "running",
      startedAt: new Date().toISOString(),
      parentExecutionId,
      steps: [],
    };
  }

  save(execution: ActionExecution): ActionExecution {
    this.data.set(execution.executionId, structuredClone(execution));
    this.enforceRetention(100);
    return execution;
  }

  findById(id: string): ActionExecution | null {
    return this.data.get(id) ?? null;
  }

  findRecent(): ActionExecution[] {
    return Array.from(this.data.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  enforceRetention(max: number): void {
    const all = Array.from(this.data.values());
    if (all.length <= max) return;
    const sorted = all.sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
    for (const ex of sorted.slice(0, all.length - max)) {
      this.data.delete(ex.executionId);
    }
  }
}

describe("ActionExecutionService", () => {
  it("begin → step → finalize emittiert Updates", () => {
    const store = new InMemoryExecutionStore();
    const service = new ActionExecutionService(store as never);
    const emitted: ActionExecution[] = [];
    service.setLiveUpdateService({
      emit: (_event: string, payload: unknown) => {
        emitted.push(payload as ActionExecution);
      },
    } as never);

    const action = {
      actionId: "a1",
      name: "Licht an",
      triggerType: "manual",
    } as Action;

    const id = service.beginExecution(action, "run_now");
    expect(id).toBeTruthy();
    expect(emitted.length).toBe(1);
    expect(emitted[0].status).toBe("running");

    const node = { nodeId: "n1", name: "Gerät", type: "action" } as Node;
    service.recordNodeStart("a1", node);
    service.recordInvocation("a1", { kind: "device", label: "setPowerOn", args: [true] });
    service.recordNodeEnd("a1", { success: true, environment: { environment: new Map() } });

    service.finalize("a1", { success: true, environment: { environment: new Map() } });

    const final = store.findById(id!);
    expect(final?.status).toBe("completed");
    expect(final?.steps.length).toBe(1);
    expect(final?.steps[0].invocations?.[0].label).toBe("setPowerOn");
    expect(emitted.length).toBeGreaterThanOrEqual(3);
  });

  it("schließt verschachtelte Schritte in umgekehrter Reihenfolge (Stack)", () => {
    const store = new InMemoryExecutionStore();
    const service = new ActionExecutionService(store as never);
    const action = { actionId: "a1", name: "Test", triggerType: "manual" } as Action;
    const id = service.beginExecution(action, "run_now")!;

    const trigger = { nodeId: "t1", name: "Trigger", type: "trigger" } as Node;
    const variable = { nodeId: "v1", name: "Var", type: "variable" } as Node;
    const actionNode = { nodeId: "a1", name: "Action", type: "action" } as Node;
    const env = { success: true, environment: { environment: new Map() } };

    service.recordNodeStart("a1", trigger);
    service.recordNodeStart("a1", variable);
    service.recordNodeStart("a1", actionNode);
    service.recordNodeEnd("a1", env);
    service.recordNodeEnd("a1", env);
    service.recordNodeEnd("a1", env);
    service.finalize("a1", env);

    const final = store.findById(id)!;
    expect(final.steps).toHaveLength(3);
    expect(final.steps.every((s) => s.status === "completed")).toBe(true);
  });

  it("enforceRetention über Store hält max. 100 Einträge", () => {
    const store = new InMemoryExecutionStore();
    for (let i = 0; i < 105; i++) {
      const ex = store.createSkeleton("a", "A", "manual");
      ex.executionId = `id-${i}`;
      ex.startedAt = new Date(2026, 0, 1, 0, 0, i).toISOString();
      store.save(ex);
    }
    expect(store.findRecent().length).toBe(100);
  });
});
