/** Zeile der Tabelle `device_tv_channels`. */
export class DbDeviceTvChannel {
  readonly deviceId!: string;
  readonly sortIndex!: number;
  readonly channelId!: string | null;
  readonly name!: string | null;
  readonly channelNumber!: number | null;
  readonly homeChannelNumber!: number | null;
  readonly channelType!: string | null;
  readonly isHd!: boolean | null;
  readonly imgUrl!: string | null;

  constructor(fields: DbDeviceTvChannel) {
    Object.assign(this, fields);
  }
}
