/** Zeile der Tabelle `action_node_action_values`. */
export class DbActionNodeActionValue {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly sortIndex!: number;
  readonly valueType!: "string" | "number" | "boolean" | "null";
  readonly valueText!: string | null;

  constructor(fields: DbActionNodeActionValue) {
    Object.assign(this, fields);
  }
}
