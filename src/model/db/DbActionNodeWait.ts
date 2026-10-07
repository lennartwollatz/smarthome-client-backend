export const DB_ACTION_NODE_WAIT_TYPES = ["time", "trigger"] as const;
export type DbActionNodeWaitType = (typeof DB_ACTION_NODE_WAIT_TYPES)[number];

/** Zeile der Tabelle `action_node_waits`. */
export class DbActionNodeWait {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly waitType!: DbActionNodeWaitType | null;
  readonly waitSeconds!: number | null;
  readonly deviceId!: string | null;
  readonly moduleId!: string | null;
  readonly eventType!: string | null;
  readonly timeoutSeconds!: number | null;

  constructor(fields: DbActionNodeWait) {
    Object.assign(this, fields);
  }
}
