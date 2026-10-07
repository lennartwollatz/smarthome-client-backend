export const DB_ACTION_NODE_LOOP_TYPES = ["for", "while"] as const;
export type DbActionNodeLoopType = (typeof DB_ACTION_NODE_LOOP_TYPES)[number];

/** Zeile der Tabelle `action_node_loops`. */
export class DbActionNodeLoop {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly loopType!: DbActionNodeLoopType | null;
  readonly iterationCount!: number | null;
  readonly maxIterations!: number | null;

  constructor(fields: DbActionNodeLoop) {
    Object.assign(this, fields);
  }
}
