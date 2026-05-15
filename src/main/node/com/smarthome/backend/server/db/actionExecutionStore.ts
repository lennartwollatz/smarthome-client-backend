import { randomUUID } from "node:crypto";
import type { DatabaseManager } from "./database.js";
import { JsonRepository } from "./jsonRepository.js";
import type { ActionExecution } from "../api/entities/actions/execution/actionExecution.js";

const DEFAULT_RETENTION = 100;

export class ActionExecutionStore {
  private repo: JsonRepository<ActionExecution>;

  constructor(db: DatabaseManager) {
    this.repo = new JsonRepository<ActionExecution>(db, "ActionExecution");
  }

  save(execution: ActionExecution): ActionExecution {
    this.repo.save(execution.executionId, execution);
    this.enforceRetention(DEFAULT_RETENTION);
    return execution;
  }

  findById(executionId: string): ActionExecution | null {
    return this.repo.findById(executionId);
  }

  findRecent(limit = DEFAULT_RETENTION): ActionExecution[] {
    const all = this.repo.findAll();
    return all
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  enforceRetention(max = DEFAULT_RETENTION): void {
    const all = this.repo.findAll();
    if (all.length <= max) return;
    const sorted = all.sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
    const toDelete = sorted.slice(0, all.length - max);
    for (const ex of toDelete) {
      this.repo.deleteById(ex.executionId);
    }
  }

  createSkeleton(
    actionId: string,
    actionName: string,
    trigger: ActionExecution["trigger"],
    parentExecutionId?: string
  ): ActionExecution {
    return {
      executionId: randomUUID(),
      actionId,
      actionName,
      trigger,
      status: "running",
      startedAt: new Date().toISOString(),
      parentExecutionId,
      steps: [],
    };
  }
}
