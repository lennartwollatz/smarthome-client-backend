/** PUT /api/modules/calendar/events/:eventId – nur angegebene Felder werden geändert. */
export class Request_CalendarUpdateEvent {
  readonly eventId!: string;
  readonly start?: string | null;
  readonly end?: string | null;
  readonly calendarId?: string | null;
  readonly title?: string | null;
  readonly description?: string | null;
  readonly location?: string | null;
  readonly notificationEnabled?: boolean | null;
  readonly allDay?: boolean | null;

  constructor(fields: Request_CalendarUpdateEvent) {
    Object.assign(this, fields);
  }
}
