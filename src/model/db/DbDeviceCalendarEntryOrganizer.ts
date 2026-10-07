/** Zeile der Tabelle `device_calendar_entry_organizers`. */
export class DbDeviceCalendarEntryOrganizer {
  readonly calendarId!: string;
  readonly entryId!: string;
  readonly name!: string | null;
  readonly email!: string | null;

  constructor(fields: DbDeviceCalendarEntryOrganizer) {
    Object.assign(this, fields);
  }
}
