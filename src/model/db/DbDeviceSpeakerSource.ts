/** Zeile der Tabelle `device_speaker_sources`. */
export class DbDeviceSpeakerSource {
  readonly deviceId!: string;
  readonly sortIndex!: number;
  readonly sourceKey!: string | null;
  readonly displayName!: string | null;
  readonly isSelected!: boolean | null;

  constructor(fields: DbDeviceSpeakerSource) {
    Object.assign(this, fields);
  }
}
