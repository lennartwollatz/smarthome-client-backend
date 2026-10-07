/** DELETE /api/modules/calendar/events/:eventId */
export class Request_CalendarDeleteEvent {
  readonly eventId!: string;

  constructor(fields: Request_CalendarDeleteEvent) {
    Object.assign(this, fields);
  }
}
