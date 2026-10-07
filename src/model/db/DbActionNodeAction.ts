export const DB_ACTION_NODE_ACTION_TYPES = ["device", "scene", "action"] as const;
export type DbActionNodeActionType = (typeof DB_ACTION_NODE_ACTION_TYPES)[number];

/** Zeile der Tabelle `action_node_actions`. */
export class DbActionNodeAction {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly actionType!: DbActionNodeActionType | null;
  readonly actionName!: string | null;
  readonly deviceId!: string | null;
  readonly moduleId!: string | null;
  readonly sceneId!: string | null;
  readonly calledActionId!: string | null;

  constructor(fields: DbActionNodeAction) {
    Object.assign(this, fields);
  }
}
