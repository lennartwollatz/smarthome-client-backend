/** POST /api/modules/calendar-apple/pair/:credentialsId */
export class Request_AppleCalendarPairCredentials {
  readonly credentialsId!: string;

  constructor(fields: Request_AppleCalendarPairCredentials) {
    Object.assign(this, fields);
  }
}
