/** Zeile der Tabelle `matter_discovered_device_txt_records`. */
export class DbMatterDiscoveredDeviceTxtRecord {
  readonly matterDiscoveredDeviceId!: string;
  readonly recordKey!: string;
  readonly recordValue!: string;

  constructor(fields: DbMatterDiscoveredDeviceTxtRecord) {
    Object.assign(this, fields);
  }
}
