/** Zeile der Tabelle `action_node_trigger_devices`. */
export class DbActionNodeTriggerDevice {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly deviceId!: string | null;
  readonly moduleId!: string | null;
  readonly eventType!: string | null;

  constructor(fields: DbActionNodeTriggerDevice) {
    Object.assign(this, fields);
  }
}
