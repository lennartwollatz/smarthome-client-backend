/** POST /api/modules/calendar/events – ID des angelegten Termins. */
export class Response_CalendarCreateEvent {
  constructor(readonly id: string) {}
}
