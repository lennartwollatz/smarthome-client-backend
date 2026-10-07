/** PUT /api/users/:userId */
export class Request_UpdateUser {
  readonly userId!: string;
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

  constructor(fields: Request_UpdateUser) {
    Object.assign(this, fields);
  }
}
