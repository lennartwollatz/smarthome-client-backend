import { EventTemperatureChanged } from "../../server/events/events/EventTemperatureChanged.js";
import { EventTemperatureEquals } from "../../server/events/events/EventTemperatureEquals.js";
import { EventTemperatureGreater } from "../../server/events/events/EventTemperatureGreater.js";
import { EventTemperatureLess } from "../../server/events/events/EventTemperatureLess.js";
import { EventHumidityChanged } from "../../server/events/events/EventHumidityChanged.js";
import { EventHumidityEquals } from "../../server/events/events/EventHumidityEquals.js";
import { EventHumidityGreater } from "../../server/events/events/EventHumidityGreater.js";
import { EventHumidityLess } from "../../server/events/events/EventHumidityLess.js";
import { EventPrecipitationProbabilityChanged } from "../../server/events/events/EventPrecipitationProbabilityChanged.js";
import { EventPrecipitationProbabilityEquals } from "../../server/events/events/EventPrecipitationProbabilityEquals.js";
import { EventPrecipitationProbabilityGreater } from "../../server/events/events/EventPrecipitationProbabilityGreater.js";
import { EventPrecipitationProbabilityLess } from "../../server/events/events/EventPrecipitationProbabilityLess.js";
import { EventUvIndexChanged } from "../../server/events/events/EventUvIndexChanged.js";
import { EventUvIndexEquals } from "../../server/events/events/EventUvIndexEquals.js";
import { EventUvIndexGreater } from "../../server/events/events/EventUvIndexGreater.js";
import { EventUvIndexLess } from "../../server/events/events/EventUvIndexLess.js";
import { EventWeatherCodeChanged } from "../../server/events/events/EventWeatherCodeChanged.js";
import { EventWeatherCodeEquals } from "../../server/events/events/EventWeatherCodeEquals.js";
import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";

/** Feste ID für das zentrale Wetter-Gerät (analog `DEFAULT_CALENDAR_DEVICE_ID`). */
export const DEFAULT_WEATHER_DEVICE_ID = "weather-device";

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

export abstract class DeviceWeather extends Device {
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

  constructor(init?: Partial<DeviceWeather>) {
    super();
    this.assignInit(init as object);
    this.type = DeviceType.WEATHER;
  }

  abstract updateValues(): Promise<void>;

  override toDatabaseJson(): Record<string, unknown> {
    return {
      ...super.toDatabaseJson(),
      t: this.temperature ?? 0,
      wc: this.weatherCode ?? 0,
      ws: this.windSpeedMps ?? 0,
      wd: this.windDirection ?? 0,
      h: this.humidity ?? 0,
      pr: this.pressure ?? 0,
      pp: this.precipitationProbability ?? 0,
      uv: this.uvIndex ?? 0,
      rn: this.rain ?? 0,
      sh: this.showers ?? 0,
      sf: this.snowfall ?? 0,
      sd: this.snowDepth ?? 0,
      vi: this.visibility ?? 0,
      tmx: this.temperatureMax ?? 0,
      tmn: this.temperatureMin ?? 0,
      sr: this.sunrise ?? null,
      ss: this.sunset ?? null,
    };
  }

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
  
    isTemperatureGreater(temperature: number): boolean {
      return (this.temperature ?? 0) > temperature;
    }
    isTemperatureLess(temperature: number): boolean {
      return (this.temperature ?? 0) < temperature;
    }
    isTemperatureEquals(temperature: number): boolean {
      return (this.temperature ?? 0) === temperature;
    }
    isHumidityGreater(humidity: number): boolean {
      return (this.humidity ?? 0) > humidity;
    }
    isHumidityLess(humidity: number): boolean {
      return (this.humidity ?? 0) < humidity;
    }
    isHumidityEquals(humidity: number): boolean {
      return (this.humidity ?? 0) === humidity;
    }
    isPrecipitationProbabilityGreater(precipitationProbability: number): boolean {
      return (this.precipitationProbability ?? 0) > precipitationProbability;
    }
    isPrecipitationProbabilityLess(precipitationProbability: number): boolean {
      return (this.precipitationProbability ?? 0) < precipitationProbability;
    }
    isPrecipitationProbabilityEquals(precipitationProbability: number): boolean {
      return (this.precipitationProbability ?? 0) === precipitationProbability;
    }
    isUvIndexGreater(uvIndex: number): boolean {
      return (this.uvIndex ?? 0) > uvIndex;
    }
    isUvIndexLess(uvIndex: number): boolean {
      return (this.uvIndex ?? 0) < uvIndex;
    }
    isUvIndexEquals(uvIndex: number): boolean {
      return (this.uvIndex ?? 0) === uvIndex;
    }
    isWeatherCodeEquals(weatherCode: number): boolean {
      return this.weatherCode === weatherCode;
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



    setTemperature(temperature: number, trigger: boolean = true) {
      this.temperature = temperature;
      if (trigger) {
        this.eventManager?.triggerEvent(new EventTemperatureChanged(this.id, { ...this }, temperature));
        this.eventManager?.triggerEvent(new EventTemperatureEquals(this.id, { ...this }, temperature));
        this.eventManager?.triggerEvent(new EventTemperatureLess(this.id, { ...this }, temperature));
        this.eventManager?.triggerEvent(new EventTemperatureGreater(this.id, { ...this }, temperature));
      }
    }

    setHumidity(humidity: number, trigger: boolean = true) {
      this.humidity = humidity;
      if (trigger) {
        this.eventManager?.triggerEvent(new EventHumidityChanged(this.id, { ...this }, humidity));
        this.eventManager?.triggerEvent(new EventHumidityEquals(this.id, { ...this }, humidity));
        this.eventManager?.triggerEvent(new EventHumidityLess(this.id, { ...this }, humidity));
        this.eventManager?.triggerEvent(new EventHumidityGreater(this.id, { ...this }, humidity));
      }
    }

    setPrecipitationProbability(precipitationProbability: number, trigger: boolean = true) {
      this.precipitationProbability = precipitationProbability;
      if (trigger) {
        this.eventManager?.triggerEvent(new EventPrecipitationProbabilityChanged(this.id, { ...this }, precipitationProbability));
        this.eventManager?.triggerEvent(new EventPrecipitationProbabilityEquals(this.id, { ...this }, precipitationProbability));
        this.eventManager?.triggerEvent(new EventPrecipitationProbabilityLess(this.id, { ...this }, precipitationProbability));
        this.eventManager?.triggerEvent(new EventPrecipitationProbabilityGreater(this.id, { ...this }, precipitationProbability));
      }
    }

    setUvIndex(uvIndex: number, trigger: boolean = true) {
      this.uvIndex = uvIndex;
      if (trigger) {
        this.eventManager?.triggerEvent(new EventUvIndexChanged(this.id, { ...this }, uvIndex));
        this.eventManager?.triggerEvent(new EventUvIndexEquals(this.id, { ...this }, uvIndex));
        this.eventManager?.triggerEvent(new EventUvIndexLess(this.id, { ...this }, uvIndex));
        this.eventManager?.triggerEvent(new EventUvIndexGreater(this.id, { ...this }, uvIndex));
      }
    }

    setWeatherCode(weatherCode: number, trigger: boolean = true) {
      this.weatherCode = weatherCode;
      if (trigger) {
        this.eventManager?.triggerEvent(new EventWeatherCodeChanged(this.id, { ...this }, weatherCode));
        this.eventManager?.triggerEvent(new EventWeatherCodeEquals(this.id, { ...this }, weatherCode));
      }
    }
}
