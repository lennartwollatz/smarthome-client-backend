/** Zeile der Tabelle `calendar_discovered_devices`. */
export class DbCalendarDiscoveredDevice {
  readonly id!: string;
  readonly name!: string | null;
  readonly address!: string | null;
  readonly port!: number | null;

  constructor(fields: DbCalendarDiscoveredDevice) {
    Object.assign(this, fields);
  }
}
