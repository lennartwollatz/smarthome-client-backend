/** Zeile der Tabelle `device_calendar_entry_attendees`. */
export class DbDeviceCalendarEntryAttendee {
  readonly calendarId!: string;
  readonly entryId!: string;
  readonly sortIndex!: number;
  readonly name!: string | null;
  readonly email!: string | null;
  readonly role!: string | null;
  readonly status!: string | null;

  constructor(fields: DbDeviceCalendarEntryAttendee) {
    Object.assign(this, fields);
  }
}
