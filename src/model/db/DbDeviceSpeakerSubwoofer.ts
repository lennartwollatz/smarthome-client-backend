/** Zeile der Tabelle `device_speaker_subwoofers`. */
export class DbDeviceSpeakerSubwoofer {
  readonly deviceId!: string;
  readonly sortIndex!: number;
  readonly subwooferId!: string | null;
  readonly name!: string | null;
  readonly isPowered!: boolean | null;
  readonly levelDb!: number | null;

  constructor(fields: DbDeviceSpeakerSubwoofer) {
    Object.assign(this, fields);
  }
}
