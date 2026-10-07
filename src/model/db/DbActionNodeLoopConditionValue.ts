/** Zeile der Tabelle `action_node_loop_condition_values`. */
export class DbActionNodeLoopConditionValue {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly sortIndex!: number;
  readonly valueType!: "string" | "number" | "boolean" | "null";
  readonly valueText!: string | null;

  constructor(fields: DbActionNodeLoopConditionValue) {
    Object.assign(this, fields);
  }
}
