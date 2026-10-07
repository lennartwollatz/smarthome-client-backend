/** Zeile der Tabelle `heos_discovered_devices`; `id` ist die UDN. */
export class DbHeosDiscoveredDevice {
  readonly id!: string;
  readonly name!: string | null;
  readonly address!: string | null;
  readonly port!: number | null;
  readonly friendlyName!: string | null;
  readonly modelName!: string | null;
  readonly modelNumber!: string | null;
  readonly deviceId!: string | null;
  readonly wlanMac!: string | null;
  readonly ipv4Address!: string | null;
  readonly ipv6Address!: string | null;
  readonly mdnsName!: string | null;
  readonly firmwareVersion!: string | null;
  readonly serialNumber!: string | null;
  readonly manufacturer!: string | null;
  readonly ipAddress!: string | null;
  readonly pid!: number | null;

  constructor(fields: DbHeosDiscoveredDevice) {
    Object.assign(this, fields);
  }
}
