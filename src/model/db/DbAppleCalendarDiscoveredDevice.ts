/** Zeile der Tabelle `apple_calendar_discovered_devices`. */
export class DbAppleCalendarDiscoveredDevice {
  readonly id!: string;
  readonly name!: string | null;
  readonly address!: string | null;
  readonly port!: number | null;

  constructor(fields: DbAppleCalendarDiscoveredDevice) {
    Object.assign(this, fields);
  }
}
