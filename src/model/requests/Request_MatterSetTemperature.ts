/** POST /api/modules/matter/devices/:deviceId/setTemperature – `temperature` hat Vorrang vor `temperatureGoal`. */
export class Request_MatterSetTemperature {
  readonly deviceId!: string;
  readonly temperature?: number | null;
  readonly temperatureGoal?: number | null;

  constructor(fields: Request_MatterSetTemperature) {
    Object.assign(this, fields);
  }
}
