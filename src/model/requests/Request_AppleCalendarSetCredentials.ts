/** PUT /api/modules/calendar-apple/credentials/:credentialsId */
export class Request_AppleCalendarSetCredentials {
  readonly credentialsId!: string;
  readonly username!: string;
  readonly password?: string | null;
  readonly server?: string | null;

  constructor(fields: Request_AppleCalendarSetCredentials) {
    Object.assign(this, fields);
  }
}
