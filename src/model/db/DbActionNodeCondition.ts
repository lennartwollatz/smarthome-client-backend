/** Zeile der Tabelle `action_node_conditions`. */
export class DbActionNodeCondition {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly deviceId!: string | null;
  readonly moduleId!: string | null;
  readonly propertyName!: string | null;

  constructor(fields: DbActionNodeCondition) {
    Object.assign(this, fields);
  }
}
