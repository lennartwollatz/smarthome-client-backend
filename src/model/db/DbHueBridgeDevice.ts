/** Zeile der Tabelle `hue_bridge_devices`. */
export class DbHueBridgeDevice {
  readonly hueBridgeId!: string;
  readonly deviceId!: string;
  readonly sortIndex!: number;

  constructor(fields: DbHueBridgeDevice) {
    Object.assign(this, fields);
  }
}
