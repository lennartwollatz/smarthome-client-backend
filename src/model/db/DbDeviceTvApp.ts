/** Zeile der Tabelle `device_tv_apps`. */
export class DbDeviceTvApp {
  readonly deviceId!: string;
  readonly sortIndex!: number;
  readonly appId!: string | null;
  readonly name!: string | null;
  readonly imgUrl!: string | null;
  readonly homeAppNumber!: number | null;

  constructor(fields: DbDeviceTvApp) {
    Object.assign(this, fields);
  }
}
