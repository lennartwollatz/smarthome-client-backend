/** Zeile der Tabelle `device_calendar_users`. */
export class DbDeviceCalendarUser {
  readonly calendarId!: string;
  readonly userId!: string;
  readonly sortIndex!: number;

  constructor(fields: DbDeviceCalendarUser) {
    Object.assign(this, fields);
  }
}
