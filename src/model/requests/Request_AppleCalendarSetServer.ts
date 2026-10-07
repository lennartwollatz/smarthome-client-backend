/** PUT /api/modules/calendar-apple/credentials/:credentialsId/server */
export class Request_AppleCalendarSetServer {
  readonly credentialsId!: string;
  readonly server!: string;

  constructor(fields: Request_AppleCalendarSetServer) {
    Object.assign(this, fields);
  }
}
