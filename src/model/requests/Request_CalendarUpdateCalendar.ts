/** PUT /api/modules/calendar/calendars/:calendarId */
export class Request_CalendarUpdateCalendar {
  readonly calendarId!: string;
  readonly show?: boolean | null;
  readonly color?: string | null;
  readonly name?: string | null;
  readonly assignedUserIds?: string[] | null;

  constructor(fields: Request_CalendarUpdateCalendar) {
    Object.assign(this, fields);
  }
}
