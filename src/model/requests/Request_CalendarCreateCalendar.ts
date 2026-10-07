/** POST /api/modules/calendar/calendars */
export class Request_CalendarCreateCalendar {
  readonly id?: string | null;
  readonly name!: string;
  readonly color!: string;
  readonly show!: boolean;

  constructor(fields: Request_CalendarCreateCalendar) {
    Object.assign(this, fields);
  }
}
