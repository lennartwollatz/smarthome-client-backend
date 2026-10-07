/** Zeile der Tabelle `device_weather_reports`. */
export class DbDeviceWeatherReport {
  readonly deviceId!: string;
  readonly latitude!: number | null;
  readonly longitude!: number | null;
  readonly temperature!: number | null;
  readonly temperatureMin!: number | null;
  readonly temperatureMax!: number | null;
  readonly weatherCode!: number | null;
  readonly humidity!: number | null;
  readonly pressure!: number | null;
  readonly visibility!: number | null;
  readonly uvIndex!: number | null;
  readonly windSpeedMps!: number | null;
  readonly windSpeedMax!: number | null;
  readonly windDirection!: number | null;
  readonly windDirectionDominant!: number | null;
  readonly precipitationProbability!: number | null;
  readonly rain!: number | null;
  readonly rainSum!: number | null;
  readonly showers!: number | null;
  readonly showersSum!: number | null;
  readonly snowfall!: number | null;
  readonly snowfallSum!: number | null;
  readonly snowDepth!: number | null;
  readonly sunrise!: string | null;
  readonly sunset!: string | null;
  readonly daylightDuration!: number | null;
  readonly sunshineDuration!: number | null;

  constructor(fields: DbDeviceWeatherReport) {
    Object.assign(this, fields);
  }
}
