/** PUT /api/modules/calendar/calendars/:calendarId – Echo der übergebenen Änderung samt Kalender-ID. */
export class Response_CalendarUpdateCalendar {
  readonly id!: string;
  readonly show?: boolean | null;
  readonly color?: string | null;
  readonly name?: string | null;
  readonly assignedUserIds?: string[] | null;

  constructor(fields: Response_CalendarUpdateCalendar) {
    Object.assign(this, fields);
  }
}
