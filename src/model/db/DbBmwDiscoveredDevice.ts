/** Zeile der Tabelle `bmw_discovered_devices`. */
export class DbBmwDiscoveredDevice {
  readonly id!: string;
  readonly name!: string | null;
  readonly address!: string | null;
  readonly port!: number | null;
  readonly vin!: string;
  readonly brand!: string | null;
  readonly model!: string | null;

  constructor(fields: DbBmwDiscoveredDevice) {
    Object.assign(this, fields);
  }
}
