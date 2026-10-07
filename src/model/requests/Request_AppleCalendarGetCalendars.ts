/** GET /api/modules/calendar-apple/calendars/:credentialsId */
export class Request_AppleCalendarGetCalendars {
  readonly credentialsId!: string;

  constructor(fields: Request_AppleCalendarGetCalendars) {
    Object.assign(this, fields);
  }
}
