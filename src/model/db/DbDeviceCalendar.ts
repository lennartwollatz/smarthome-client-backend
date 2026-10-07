/** Zeile der Tabelle `device_calendars`. */
export class DbDeviceCalendar {
  readonly id!: string;
  readonly deviceId!: string;
  readonly sortIndex!: number;
  readonly moduleId!: string;
  readonly name!: string;
  readonly color!: string;
  readonly isShown!: boolean;
  readonly isCreatedManually!: boolean;
  readonly credentialId!: string | null;

  constructor(fields: DbDeviceCalendar) {
    Object.assign(this, fields);
  }
}
