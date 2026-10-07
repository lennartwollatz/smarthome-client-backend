export const DB_TRIGGER_TIME_FREQUENCIES = ["once", "daily", "weekly", "monthly", "yearly"] as const;
export type DbTriggerTimeFrequency = (typeof DB_TRIGGER_TIME_FREQUENCIES)[number];

/** Zeile der Tabelle `action_node_trigger_times`. */
export class DbActionNodeTriggerTime {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly frequency!: DbTriggerTimeFrequency | null;
  /** Spalte vom Typ TIME: geschrieben als `HH:mm`, gelesen als `HH:mm:ss`. */
  readonly timeOfDay!: string | null;
  readonly dayOfMonth!: number | null;
  readonly monthOfYear!: number | null;
  readonly dayOfYear!: number | null;

  constructor(fields: DbActionNodeTriggerTime) {
    Object.assign(this, fields);
  }
}
