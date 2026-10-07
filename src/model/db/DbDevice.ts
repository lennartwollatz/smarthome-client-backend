/** Zeile der Tabelle `devices`. */
export class DbDevice {
  readonly id!: string;
  readonly name!: string | null;
  readonly icon!: string | null;
  readonly typeLabel!: string | null;
  readonly roomId!: string | null;
  readonly deviceType!: string | null;
  readonly moduleId!: string | null;
  readonly isConnected!: boolean;
  readonly isPairingMode!: boolean;
  readonly hasBattery!: boolean;
  readonly batteryLevel!: number;
  readonly quickAccess!: boolean;

  constructor(fields: DbDevice) {
    Object.assign(this, fields);
  }
}
