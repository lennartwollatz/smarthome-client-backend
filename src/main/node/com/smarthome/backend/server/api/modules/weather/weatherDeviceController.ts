import { logger } from "../../../../logger.js";
import { DeviceWeather, WeatherForecastEntry, WeatherHourlyEntry } from "../../../../model/devices/DeviceWeather.js";
import { ModuleDeviceController } from "../moduleDeviceController.js";
import { WeatherEvent } from "./weatherEvent.js";
import type { EventManager } from "../../../events/EventManager.js";
import { EventWeatherStatusChanged } from "../../../events/events/EventWeatherStatusChanged.js";
import { EventWeatherIsRaining } from "../../../events/events/EventWeatherIsRaining.js";
import { EventWeatherIsStorming } from "../../../events/events/EventWeatherIsStorming.js";
import { EventWeatherIsFreezing } from "../../../events/events/EventWeatherIsFreezing.js";
import { EventWeatherIsSnowing } from "../../../events/events/EventWeatherIsSnowing.js";
import { EventWeatherIsFoggy } from "../../../events/events/EventWeatherIsFoggy.js";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    relative_humidity_2m?: number;
    surface_pressure?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    precipitation_probability?: number;
    rain?: number;
    showers?: number;
    snowfall?: number;
    visibility?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: (number | null)[];
    weather_code?: (number | null)[];
    precipitation_probability?: (number | null)[];
    rain?: (number | null)[];
    showers?: (number | null)[];
    snowfall?: (number | null)[];
    snow_depth?: (number | null)[];
    visibility?: (number | null)[];
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    weather_code?: (number | null)[];
    uv_index_max?: (number | null)[];
    sunrise?: (string | null)[];
    sunset?: (string | null)[];
    daylight_duration?: (number | null)[];
    sunshine_duration?: (number | null)[];
    rain_sum?: (number | null)[];
    showers_sum?: (number | null)[];
    snowfall_sum?: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
    wind_direction_10m_dominant?: (number | null)[];
  };
};

export class WeatherDeviceController extends ModuleDeviceController<WeatherEvent, DeviceWeather> {
  private eventManager?: EventManager;

  constructor(eventManager?: EventManager) {
    super();
    this.eventManager = eventManager;
  }

  async fetchWeather(device: DeviceWeather): Promise<boolean> {
    const lat = device.latitude ?? 52.52;
    const lon = device.longitude ?? 13.41;

    logger.info(
      { deviceId: device.id, name: device.name, lat, lon },
      "Weather-Abfrage startet"
    );

    const url = new URL(OPEN_METEO_BASE);
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("current", "temperature_2m,weather_code,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation_probability,rain,showers,snowfall,visibility");
    url.searchParams.set("hourly", "temperature_2m,weather_code,precipitation_probability,rain,showers,snowfall,snow_depth,visibility");
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code,uv_index_max,sunrise,sunset,daylight_duration,sunshine_duration,rain_sum,showers_sum,snowfall_sum,wind_speed_10m_max,wind_direction_10m_dominant");
    url.searchParams.set("forecast_days", "3");
    url.searchParams.set("timezone", "auto");

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        logger.warn({ deviceId: device.id, status: res.status }, "Open-Meteo API Fehler");
        return false;
      }
      const data = (await res.json()) as OpenMeteoResponse;

      const deviceBefore = { ...device };
      const curr = data.current;
      const temp = curr?.temperature_2m ?? null;
      const code = curr?.weather_code ?? null;

      device.temperature = typeof temp === "number" ? temp : undefined;
      device.weatherCode = typeof code === "number" ? code : undefined;
      device.forecast = this.buildForecast(data);
      device.hourlyForecast = this.buildHourlyForecast(data);
      device.windSpeedMps = typeof curr?.wind_speed_10m === "number" ? curr.wind_speed_10m / 3.6 : undefined;
      device.humidity = typeof curr?.relative_humidity_2m === "number" ? curr.relative_humidity_2m : undefined;
      device.pressure = typeof curr?.surface_pressure === "number" ? Math.round(curr.surface_pressure) : undefined;
      device.precipitationProbability = typeof curr?.precipitation_probability === "number" ? curr.precipitation_probability : undefined;
      const uv = data.daily?.uv_index_max?.[0];
      device.uvIndex = typeof uv === "number" ? Math.round(uv) : undefined;

      // Neue Felder für KI
      device.rain = typeof curr?.rain === "number" ? curr.rain : undefined;
      device.showers = typeof curr?.showers === "number" ? curr.showers : undefined;
      device.snowfall = typeof curr?.snowfall === "number" ? curr.snowfall : undefined;
      device.visibility = typeof curr?.visibility === "number" ? curr.visibility : undefined;
      device.windDirection = typeof curr?.wind_direction_10m === "number" ? curr.wind_direction_10m : undefined;

      const hourly = data.hourly;
      if (hourly?.snow_depth?.length) {
        const now = new Date();
        let idx = 0;
        for (let i = 0; i < (hourly.time?.length ?? 0); i++) {
          const t = new Date(hourly.time![i] ?? "");
          if (t >= now) {
            idx = i;
            break;
          }
        }
        const sd = hourly.snow_depth?.[idx];
        device.snowDepth = typeof sd === "number" ? sd : undefined;
      }

      const daily = data.daily;
      const d0 = daily?.time?.[0];
      if (daily && d0) {
        device.temperatureMax = this.num(daily.temperature_2m_max?.[0]);
        device.temperatureMin = this.num(daily.temperature_2m_min?.[0]);
        device.sunrise = this.str(daily.sunrise?.[0]);
        device.sunset = this.str(daily.sunset?.[0]);
        device.daylightDuration = this.num(daily.daylight_duration?.[0]);
        device.sunshineDuration = this.num(daily.sunshine_duration?.[0]);
        device.rainSum = this.num(daily.rain_sum?.[0]);
        device.showersSum = this.num(daily.showers_sum?.[0]);
        device.snowfallSum = this.num(daily.snowfall_sum?.[0]);
        const wsm = daily.wind_speed_10m_max?.[0];
        device.windSpeedMax = typeof wsm === "number" ? wsm / 3.6 : undefined;
        device.windDirectionDominant = this.num(daily.wind_direction_10m_dominant?.[0]);
      }

      logger.debug(
        {
          deviceId: device.id,
          temperature: device.temperature,
          weatherCode: device.weatherCode,
          windSpeedMps: device.windSpeedMps,
          humidity: device.humidity,
          pressure: device.pressure,
          precipitationProbability: device.precipitationProbability,
          uvIndex: device.uvIndex,
          hourlyForecastCount: device.hourlyForecast?.length ?? 0
        },
        "Weather-Daten erfolgreich abgerufen"
      );

      this.triggerWeatherEvents(device, deviceBefore);

      return true;
    } catch (err) {
      logger.error({ err, deviceId: device.id }, "Open-Meteo API Request fehlgeschlagen");
      return false;
    }
  }

  private num(val: number | null | undefined): number | undefined {
    return typeof val === "number" ? val : undefined;
  }

  private str(val: string | null | undefined): string | undefined {
    return typeof val === "string" ? val : undefined;
  }

  private buildForecast(data: OpenMeteoResponse): WeatherForecastEntry[] {
    const entries: WeatherForecastEntry[] = [];
    const daily = data.daily;
    if (!daily?.time?.length) return entries;

    const times = daily.time;
    const temps = daily.temperature_2m_max ?? daily.temperature_2m_min ?? [];
    const codes = daily.weather_code ?? [];

    for (let i = 0; i < Math.min(times.length, 3); i++) {
      const temp = temps[i] ?? null;
      const code = codes[i] ?? null;
      const codeNum = typeof code === "number" ? code : 0;
      const tempNum = typeof temp === "number" ? temp : 0;

      entries.push({
        datetime: times[i] ?? "",
        temperature: tempNum,
        weatherCode: codeNum,
      });
    }

    return entries;
  }

  private buildHourlyForecast(data: OpenMeteoResponse): WeatherHourlyEntry[] {
    const entries: WeatherHourlyEntry[] = [];
    const hourly = data.hourly;
    if (!hourly?.time?.length) return entries;

    const times = hourly.time;
    const temps = hourly.temperature_2m ?? [];
    const codes = hourly.weather_code ?? [];
    const precip = hourly.precipitation_probability ?? [];

    const now = new Date();
    let startIdx = 0;
    for (let i = 0; i < times.length; i++) {
      const t = new Date(times[i] ?? "");
      if (t >= now) {
        startIdx = i;
        break;
      }
    }

    for (let i = startIdx; i < Math.min(startIdx + 24, times.length); i++) {
      const temp = temps[i] ?? null;
      const code = codes[i] ?? null;
      const pr = precip[i] ?? null;
      entries.push({
        datetime: times[i] ?? "",
        temperature: typeof temp === "number" ? temp : 0,
        weatherCode: typeof code === "number" ? code : 0,
        precipitationProbability: typeof pr === "number" ? pr : undefined,
      });
    }

    return entries.slice(0, 24);
  }

  private triggerWeatherEvents(device: DeviceWeather, deviceBefore: Partial<DeviceWeather>): void {
    if (!this.eventManager) return;

    const wasRaining = DeviceWeather.deriveIsRaining(deviceBefore.weatherCode);
    const wasStorming = DeviceWeather.deriveIsStorming(deviceBefore.weatherCode);
    const wasFreezing =
      typeof deviceBefore.temperature === "number" && deviceBefore.temperature <= 0;
    const wasSnowing = DeviceWeather.deriveIsSnowing(deviceBefore.weatherCode);
    const wasFoggy = DeviceWeather.deriveIsFoggy(deviceBefore.weatherCode);

    this.eventManager.triggerEvent(
      new EventWeatherStatusChanged(device.id, deviceBefore, { ...device })
    );

    const isRaining = typeof device.isRaining === "function" ? device.isRaining() : DeviceWeather.deriveIsRaining(device.weatherCode);
    const isStorming = typeof device.isStorming === "function" ? device.isStorming() : DeviceWeather.deriveIsStorming(device.weatherCode);
    const isFreezing = typeof device.isFreezing === "function" ? device.isFreezing() : (typeof device.temperature === "number" && device.temperature <= 0);
    const isSnowing = typeof device.isSnowing === "function" ? device.isSnowing() : DeviceWeather.deriveIsSnowing(device.weatherCode);
    const isFoggy = typeof device.isFoggy === "function" ? device.isFoggy() : DeviceWeather.deriveIsFoggy(device.weatherCode);

    if (isRaining && !wasRaining) {
      this.eventManager.triggerEvent(
        new EventWeatherIsRaining(device.id, deviceBefore, { ...device })
      );
    }
    if (isStorming && !wasStorming) {
      this.eventManager.triggerEvent(
        new EventWeatherIsStorming(device.id, deviceBefore, { ...device })
      );
    }
    if (isFreezing && !wasFreezing) {
      this.eventManager.triggerEvent(
        new EventWeatherIsFreezing(device.id, deviceBefore, { ...device })
      );
    }
    if (isSnowing && !wasSnowing) {
      this.eventManager.triggerEvent(
        new EventWeatherIsSnowing(device.id, deviceBefore, { ...device })
      );
    }
    if (isFoggy && !wasFoggy) {
      this.eventManager.triggerEvent(
        new EventWeatherIsFoggy(device.id, deviceBefore, { ...device })
      );
    }
  }
}
