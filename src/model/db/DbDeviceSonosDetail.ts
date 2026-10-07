/** Zeile der Tabelle `device_sonos_details`. */
export class DbDeviceSonosDetail {
  readonly deviceId!: string;
  readonly address!: string | null;
  readonly roomName!: string | null;

  constructor(fields: DbDeviceSonosDetail) {
    Object.assign(this, fields);
  }
}
