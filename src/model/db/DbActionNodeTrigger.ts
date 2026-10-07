import type { DbActionTriggerType } from "./DbAction.js";

/** Zeile der Tabelle `action_node_triggers`. */
export class DbActionNodeTrigger {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly triggerType!: DbActionTriggerType;

  constructor(fields: DbActionNodeTrigger) {
    Object.assign(this, fields);
  }
}
