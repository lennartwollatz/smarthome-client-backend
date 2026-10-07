/** Zeile der Tabelle `device_voice_assistant_details`. */
export class DbDeviceVoiceAssistantDetail {
  readonly deviceId!: string;
  readonly keyword!: string;
  readonly port!: number;
  readonly passcode!: number;
  readonly discriminator!: number;

  constructor(fields: DbDeviceVoiceAssistantDetail) {
    Object.assign(this, fields);
  }
}
