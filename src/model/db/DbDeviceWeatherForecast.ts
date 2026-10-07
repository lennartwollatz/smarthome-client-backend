/** Zeile der Tabelle `device_weather_forecasts`. */
export class DbDeviceWeatherForecast {
  readonly deviceId!: string;
  readonly sortIndex!: number;
  readonly forecastAt!: string;
  readonly temperature!: number;
  readonly weatherCode!: number;

  constructor(fields: DbDeviceWeatherForecast) {
    Object.assign(this, fields);
  }
}
