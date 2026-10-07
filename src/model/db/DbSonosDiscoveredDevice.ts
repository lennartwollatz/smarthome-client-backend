/** Zeile der Tabelle `sonos_discovered_devices`; `id` ist die UDN. */
export class DbSonosDiscoveredDevice {
  readonly id!: string;
  readonly name!: string | null;
  readonly address!: string | null;
  readonly port!: number | null;
  readonly modelName!: string | null;
  readonly modelNumber!: string | null;
  readonly wlanMac!: string | null;
  readonly serialNumber!: string | null;

  constructor(fields: DbSonosDiscoveredDevice) {
    Object.assign(this, fields);
  }
}
