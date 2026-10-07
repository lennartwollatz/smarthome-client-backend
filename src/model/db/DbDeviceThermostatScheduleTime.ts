/** Zeile der Tabelle `device_thermostat_schedule_times`. */
export class DbDeviceThermostatScheduleTime {
  readonly deviceId!: string;
  readonly scheduleIndex!: number;
  readonly timeIndex!: number;
  readonly weekday!: number;
  readonly timeOfDay!: string;
  readonly temperature!: number;

  constructor(fields: DbDeviceThermostatScheduleTime) {
    Object.assign(this, fields);
  }
}
