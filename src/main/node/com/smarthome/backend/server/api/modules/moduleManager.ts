import type { DatabaseManager } from "../../db/database.js";
import type { EventStreamManager } from "../../events/eventStreamManager.js";
import type { ActionManager } from "../../actions/actionManager.js";

export class ModuleManager {
  protected databaseManager: DatabaseManager;
  protected eventStreamManager: EventStreamManager;
  protected actionManager: ActionManager;

  constructor(databaseManager: DatabaseManager, eventStreamManager: EventStreamManager, actionManager: ActionManager) {
    this.databaseManager = databaseManager;
    this.eventStreamManager = eventStreamManager;
    this.actionManager = actionManager;
  }
}

