/** Einzige Zeile der Tabelle `home_settings` (id = 1). Zeiten im MySQL-Format `HH:MM:SS`. */
export class DbHomeSettings {
  readonly id!: number;
  readonly homeName!: string | null;
  readonly language!: string | null;
  readonly temperatureUnit!: string | null;
  readonly securityNotificationsEnabled!: boolean | null;
  readonly batteryStatusNotificationsEnabled!: boolean | null;
  readonly energyReportNotificationsEnabled!: boolean | null;
  readonly aiLearningEnabled!: boolean | null;
  readonly autoUpdateEnabled!: boolean | null;
  readonly autoUpdateTimeFrom!: string | null;
  readonly autoUpdateTimeTo!: string | null;

  constructor(fields: DbHomeSettings) {
    Object.assign(this, fields);
  }
}
