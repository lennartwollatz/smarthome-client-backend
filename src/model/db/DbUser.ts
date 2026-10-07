/** Zeile der Tabelle `users`. */
export class DbUser {
  readonly id!: string;
  readonly name!: string | null;
  readonly email!: string | null;
  readonly phoneNumber!: string | null;
  readonly role!: string | null;
  readonly avatar!: string | null;
  readonly lastActive!: string | null;
  readonly locationTrackingEnabled!: boolean;
  readonly trackingToken!: string | null;
  readonly pushNotificationsEnabled!: boolean;
  readonly emailNotificationsEnabled!: boolean;
  readonly smsNotificationsEnabled!: boolean;

  constructor(fields: DbUser) {
    Object.assign(this, fields);
  }
}
