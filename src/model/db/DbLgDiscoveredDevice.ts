/** Zeile der Tabelle `lg_discovered_devices`. */
export class DbLgDiscoveredDevice {
  readonly id!: string;
  readonly name!: string | null;
  readonly address!: string | null;
  readonly port!: number | null;
  readonly serviceType!: string | null;
  readonly manufacturer!: string | null;
  readonly integrator!: string | null;
  readonly macAddress!: string | null;

  constructor(fields: DbLgDiscoveredDevice) {
    Object.assign(this, fields);
  }
}
