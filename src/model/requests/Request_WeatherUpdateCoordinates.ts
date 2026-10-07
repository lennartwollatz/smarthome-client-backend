/** PUT /api/modules/weather/devices/:deviceId/coordinates */
export class Request_WeatherUpdateCoordinates {
  readonly deviceId!: string;
  readonly latitude?: number | null;
  readonly longitude?: number | null;

  constructor(fields: Request_WeatherUpdateCoordinates) {
    Object.assign(this, fields);
  }
}
