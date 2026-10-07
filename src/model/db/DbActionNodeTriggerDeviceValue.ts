/** Zeile der Tabelle `action_node_trigger_device_values`. */
export class DbActionNodeTriggerDeviceValue {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly sortIndex!: number;
  readonly valueType!: "string" | "number" | "boolean" | "null";
  readonly valueText!: string | null;

  constructor(fields: DbActionNodeTriggerDeviceValue) {
    Object.assign(this, fields);
  }
}
