/** Zeile der Tabelle `action_node_wait_values`. */
export class DbActionNodeWaitValue {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly sortIndex!: number;
  readonly valueType!: "string" | "number" | "boolean" | "null";
  readonly valueText!: string | null;

  constructor(fields: DbActionNodeWaitValue) {
    Object.assign(this, fields);
  }
}
