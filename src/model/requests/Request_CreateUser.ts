/** POST /api/users */
export class Request_CreateUser {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly email?: string | null;
  readonly role?: string | null;
  readonly avatar?: string | null;
  readonly lastActive?: string | null;
  readonly phoneNumber?: string | null;
  readonly trackingToken?: string | null;
  readonly locationTrackingEnabled?: boolean | null;
  readonly pushNotificationsEnabled?: boolean | null;
  readonly emailNotificationsEnabled?: boolean | null;
  readonly smsNotificationsEnabled?: boolean | null;

  constructor(fields: Request_CreateUser) {
    Object.assign(this, fields);
  }
}
