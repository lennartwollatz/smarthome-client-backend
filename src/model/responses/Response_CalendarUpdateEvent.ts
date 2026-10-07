/** PUT /api/modules/calendar/events/:eventId – Echo der übergebenen Änderung samt Termin-ID. */
export class Response_CalendarUpdateEvent {
  readonly id!: string;
  readonly start?: string | null;
  readonly end?: string | null;
  readonly calendarId?: string | null;
  readonly title?: string | null;
  readonly description?: string | null;
  readonly location?: string | null;
  readonly notificationEnabled?: boolean | null;
  readonly allDay?: boolean | null;

  constructor(fields: Response_CalendarUpdateEvent) {
    Object.assign(this, fields);
  }
}
