/** GET /api/modules/calendar/calendars/:moduleId */
export class Request_CalendarGetModuleCalendars {
  readonly moduleId!: string;

  constructor(fields: Request_CalendarGetModuleCalendars) {
    Object.assign(this, fields);
  }
}
