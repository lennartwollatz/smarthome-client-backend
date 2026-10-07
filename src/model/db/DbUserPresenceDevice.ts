/** Zeile der Tabelle `user_presence_devices`. */
export class DbUserPresenceDevice {
  readonly userId!: string;
  readonly port!: number;
  readonly passcode!: number;
  readonly discriminator!: number;
  readonly pairingCode!: string | null;

  constructor(fields: DbUserPresenceDevice) {
    Object.assign(this, fields);
  }
}
