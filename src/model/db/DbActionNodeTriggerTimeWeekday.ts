/** Zeile der Tabelle `action_node_trigger_time_weekdays`. */
export class DbActionNodeTriggerTimeWeekday {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly weekday!: number;

  constructor(fields: DbActionNodeTriggerTimeWeekday) {
    Object.assign(this, fields);
  }
}
