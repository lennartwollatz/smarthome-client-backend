/** POST /api/modules/calendar/events */
export class Request_CalendarCreateEvent {
  readonly calendarId!: string;
  readonly title?: string | null;
  readonly start!: string;
  readonly end!: string;
  readonly description?: string | null;
  readonly location?: string | null;
  readonly notificationEnabled?: boolean | null;
  readonly allDay?: boolean | null;

  constructor(fields: Request_CalendarCreateEvent) {
    Object.assign(this, fields);
  }
}
