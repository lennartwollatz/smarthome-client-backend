export type DbPlayState = "play" | "pause" | "stop";

/** Zeile der Tabelle `device_speakers`. */
export class DbDeviceSpeaker {
  readonly deviceId!: string;
  readonly playState!: DbPlayState | null;
  readonly volume!: number | null;
  readonly isMuted!: boolean | null;
  readonly volumeStart!: number | null;
  readonly volumeMax!: number | null;

  constructor(fields: DbDeviceSpeaker) {
    Object.assign(this, fields);
  }
}
