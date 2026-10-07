/** GET /api/modules/calendar/events?from=&to= – der Zeitraum (ISO) wird noch nicht ausgewertet. */
export class Request_CalendarGetEvents {
  readonly from?: string | null;
  readonly to?: string | null;

  constructor(fields: Request_CalendarGetEvents) {
    Object.assign(this, fields);
  }
}
