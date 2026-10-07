/** Zeile der Tabelle `device_speaker_zones`. */
export class DbDeviceSpeakerZone {
  readonly deviceId!: string;
  readonly sortIndex!: number;
  readonly name!: string | null;
  readonly displayName!: string | null;
  readonly isPowered!: boolean | null;

  constructor(fields: DbDeviceSpeakerZone) {
    Object.assign(this, fields);
  }
}
