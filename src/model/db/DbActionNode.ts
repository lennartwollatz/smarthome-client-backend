export const DB_ACTION_NODE_TYPES = ["trigger", "action", "condition", "wait", "loop"] as const;
export type DbActionNodeType = (typeof DB_ACTION_NODE_TYPES)[number];

/** Zeile der Tabelle `action_nodes`. */
export class DbActionNode {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly sortIndex!: number;
  readonly nodeType!: DbActionNodeType;
  readonly nodeOrder!: number | null;
  readonly name!: string | null;
  readonly positionX!: number | null;
  readonly positionY!: number | null;

  constructor(fields: DbActionNode) {
    Object.assign(this, fields);
  }
}
