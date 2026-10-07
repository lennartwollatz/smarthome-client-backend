/** Zeile der Tabelle `device_presences`. */
export class DbDevicePresence {
  readonly deviceId!: string;
  readonly isPresent!: boolean;

  constructor(fields: DbDevicePresence) {
    Object.assign(this, fields);
  }
}
