/** POST /api/modules/weather/devices/:deviceId/refresh */
export class Request_WeatherRefreshDevice {
  readonly deviceId!: string;

  constructor(fields: Request_WeatherRefreshDevice) {
    Object.assign(this, fields);
  }
}
