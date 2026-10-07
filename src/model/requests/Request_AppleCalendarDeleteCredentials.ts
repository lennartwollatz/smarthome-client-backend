/** DELETE /api/modules/calendar-apple/credentials/:credentialsId */
export class Request_AppleCalendarDeleteCredentials {
  readonly credentialsId!: string;

  constructor(fields: Request_AppleCalendarDeleteCredentials) {
    Object.assign(this, fields);
  }
}
