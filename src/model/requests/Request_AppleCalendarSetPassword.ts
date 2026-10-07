/** PUT /api/modules/calendar-apple/credentials/:credentialsId/password */
export class Request_AppleCalendarSetPassword {
  readonly credentialsId!: string;
  readonly password!: string;

  constructor(fields: Request_AppleCalendarSetPassword) {
    Object.assign(this, fields);
  }
}
