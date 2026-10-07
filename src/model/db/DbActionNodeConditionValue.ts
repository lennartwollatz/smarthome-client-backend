/** Zeile der Tabelle `action_node_condition_values`. */
export class DbActionNodeConditionValue {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly sortIndex!: number;
  readonly valueType!: "string" | "number" | "boolean" | "null";
  readonly valueText!: string | null;

  constructor(fields: DbActionNodeConditionValue) {
    Object.assign(this, fields);
  }
}
