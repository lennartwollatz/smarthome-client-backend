/** DELETE /api/modules/calendar/events/:eventId – ID des gelöschten Termins. */
export class Response_CalendarDeleteEvent {
  constructor(readonly id: string) {}
}
