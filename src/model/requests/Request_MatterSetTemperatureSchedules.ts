/** Zeitfenster eines Temperatur-Zeitplans. */
export class Request_MatterTemperatureScheduleTimeRange {
  readonly weekday!: number;
  readonly time!: string;
  readonly temperature!: number;

  constructor(fields: Request_MatterTemperatureScheduleTimeRange) {
    Object.assign(this, fields);
  }
}

/** Temperatur-Zeitplan eines Thermostats. */
export class Request_MatterTemperatureSchedule {
  readonly rulename: string;
  readonly rulevalue: Request_MatterTemperatureScheduleTimeRange[];
  readonly active: boolean;

  constructor(fields: Request_MatterTemperatureSchedule) {
    this.rulename = fields.rulename;
    this.rulevalue = fields.rulevalue.map(timeRange => new Request_MatterTemperatureScheduleTimeRange(timeRange));
    this.active = fields.active;
  }
}

/** POST /api/modules/matter/devices/:deviceId/setTemperatureSchedules */
export class Request_MatterSetTemperatureSchedules {
  readonly deviceId: string;
  readonly temperatureSchedules?: Request_MatterTemperatureSchedule[] | null;

  constructor(fields: Request_MatterSetTemperatureSchedules) {
    this.deviceId = fields.deviceId;
    this.temperatureSchedules = fields.temperatureSchedules?.map(schedule => new Request_MatterTemperatureSchedule(schedule));
  }
}
