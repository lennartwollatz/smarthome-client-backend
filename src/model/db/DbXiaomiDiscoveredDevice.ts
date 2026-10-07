/** Zeile der Tabelle `xiaomi_discovered_devices`. */
export class DbXiaomiDiscoveredDevice {
  readonly id!: string;
  readonly name!: string | null;
  readonly address!: string | null;
  readonly port!: number | null;
  readonly model!: string | null;
  readonly token!: string | null;
  readonly mac!: string | null;
  readonly did!: string | null;
  readonly locale!: string | null;
  readonly status!: string | null;

  constructor(fields: DbXiaomiDiscoveredDevice) {
    Object.assign(this, fields);
  }
}
