import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";

export type WeatherForecastEntry = {
  datetime: string;
  temperature: number;
  weatherCode: number;
};

export type WeatherHourlyEntry = {
  datetime: string;
  temperature: number;
  weatherCode: number;
  precipitationProbability?: number;
};

export class DeviceWeather extends Device {
  latitude?: number;
  longitude?: number;
  temperature?: number;
  weatherCode?: number;
  forecast: WeatherForecastEntry[] = [];
  hourlyForecast: WeatherHourlyEntry[] = [];
  windSpeedMps?: number;
  humidity?: number;
  pressure?: number;
  precipitationProbability?: number;
  uvIndex?: number;
  /** Regen in mm (aktuell) */
  rain?: number;
  /** Schauer in mm (aktuell) */
  showers?: number;
  /** Schneefall in cm (aktuell) */
  snowfall?: number;
  /** Schneehöhe in m */
  snowDepth?: number;
  /** Sichtweite in m */
  visibility?: number;
  /** Windrichtung in ° (0-360) */
  windDirection?: number;
  /** Max. Temperatur heute °C */
  temperatureMax?: number;
  /** Min. Temperatur heute °C */
  temperatureMin?: number;
  /** Sonnenaufgang ISO */
  sunrise?: string;
  /** Sonnenuntergang ISO */
  sunset?: string;
  /** Tageslänge in Sekunden */
  daylightDuration?: number;
  /** Sonnenscheindauer in Sekunden */
  sunshineDuration?: number;
  /** Regen-Summe heute in mm */
  rainSum?: number;
  /** Schneefall-Summe heute in cm */
  snowfallSum?: number;
  /** Schauer-Summe heute in mm */
  showersSum?: number;
  /** Max. Windgeschwindigkeit heute m/s */
  windSpeedMax?: number;
  /** Dominante Windrichtung heute in ° */
  windDirectionDominant?: number;

  /** Regen aus WMO-Code (51-67, 80-82) */
  isRaining(): boolean {
    return this.deriveIsRaining(this.weatherCode);
  }

  /** Gewitter aus WMO-Code (95-99) */
  isStorming(): boolean {
    return this.deriveIsStorming(this.weatherCode);
  }

  /** Frost aus Temperatur */
  isFreezing(): boolean {
    return typeof this.temperature === "number" && this.temperature <= 0;
  }

  /** Schnee aus WMO-Code (71-77, 85-86) */
  isSnowing(): boolean {
    return this.deriveIsSnowing(this.weatherCode);
  }

  /** Nebel aus WMO-Code (45, 48) */
  isFoggy(): boolean {
    return this.deriveIsFoggy(this.weatherCode);
  }

  static deriveIsRaining(code: number | undefined): boolean {
    if (typeof code !== "number") return false;
    return (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
  }

  static deriveIsStorming(code: number | undefined): boolean {
    if (typeof code !== "number") return false;
    return code >= 95 && code <= 99;
  }

  static deriveIsSnowing(code: number | undefined): boolean {
    if (typeof code !== "number") return false;
    return (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
  }

  static deriveIsFoggy(code: number | undefined): boolean {
    if (typeof code !== "number") return false;
    return code === 45 || code === 48;
  }

  private deriveIsRaining(code: number | undefined): boolean {
    return DeviceWeather.deriveIsRaining(code);
  }

  private deriveIsStorming(code: number | undefined): boolean {
    return DeviceWeather.deriveIsStorming(code);
  }

  private deriveIsSnowing(code: number | undefined): boolean {
    return DeviceWeather.deriveIsSnowing(code);
  }

  private deriveIsFoggy(code: number | undefined): boolean {
    return DeviceWeather.deriveIsFoggy(code);
  }

  constructor(init?: Partial<DeviceWeather>) {
    super();
    this.assignInit(init as object);
    this.type = DeviceType.WEATHER;
  }

  async updateValues(): Promise<void> {
    // Wird vom WeatherDeviceController über Open-Meteo API befüllt
  }
}
