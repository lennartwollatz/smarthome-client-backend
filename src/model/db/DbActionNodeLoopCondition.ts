/** Zeile der Tabelle `action_node_loop_conditions`. */
export class DbActionNodeLoopCondition {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly deviceId!: string | null;
  readonly moduleId!: string | null;
  readonly propertyName!: string | null;

  constructor(fields: DbActionNodeLoopCondition) {
    Object.assign(this, fields);
  }
}
