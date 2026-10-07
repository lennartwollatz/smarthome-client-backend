/** Zeile der Tabelle `device_buttons`. */
export class DbDeviceButton {
  readonly deviceId!: string;
  readonly buttonId!: string;
  readonly sortIndex!: number;
  readonly name!: string | null;
  readonly isConnectedToLight!: boolean | null;
  readonly isOn!: boolean;
  readonly pressCount!: number;
  readonly initialPressTime!: number;
  readonly firstPressTime!: number;
  readonly lastPressTime!: number;
  readonly intensity!: number | null;

  constructor(fields: DbDeviceButton) {
    Object.assign(this, fields);
  }
}
