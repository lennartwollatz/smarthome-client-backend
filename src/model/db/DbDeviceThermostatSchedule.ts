/** Zeile der Tabelle `device_thermostat_schedules`. */
export class DbDeviceThermostatSchedule {
  readonly deviceId!: string;
  readonly scheduleIndex!: number;
  readonly ruleName!: string;
  readonly isActive!: boolean;

  constructor(fields: DbDeviceThermostatSchedule) {
    Object.assign(this, fields);
  }
}
