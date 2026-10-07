/** Zeile der Tabelle `device_weather_hourly_forecasts`. */
export class DbDeviceWeatherHourlyForecast {
  readonly deviceId!: string;
  readonly sortIndex!: number;
  readonly forecastAt!: string;
  readonly temperature!: number;
  readonly weatherCode!: number;
  readonly precipitationProbability!: number | null;

  constructor(fields: DbDeviceWeatherHourlyForecast) {
    Object.assign(this, fields);
  }
}
