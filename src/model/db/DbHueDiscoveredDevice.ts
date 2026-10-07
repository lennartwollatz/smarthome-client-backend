/** Zeile der Tabelle `hue_discovered_devices`. */
export class DbHueDiscoveredDevice {
  readonly id!: string;
  readonly name!: string | null;
  readonly address!: string | null;
  readonly port!: number | null;

  constructor(fields: DbHueDiscoveredDevice) {
    Object.assign(this, fields);
  }
}
