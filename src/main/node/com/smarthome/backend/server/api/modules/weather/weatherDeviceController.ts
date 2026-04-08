import { logger } from "../../../../logger.js";
import { DeviceWeather } from "../../../../model/devices/DeviceWeather.js";
import { ModuleDeviceController } from "../moduleDeviceController.js";
import { WeatherEvent } from "./weatherEvent.js";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

export type OpenMeteoResponse = {
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

  constructor() {
    super();
  }

  async fetchWeather(device: DeviceWeather): Promise<OpenMeteoResponse | null> {
    const lat = device.latitude ?? 52.52;
    const lon = device.longitude ?? 13.41;

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
        return null;
      }
      return (await res.json()) as OpenMeteoResponse;

    } catch (err) {
      logger.error({ err, deviceId: device.id }, "Open-Meteo API Request fehlgeschlagen");
      return null;
    }
  }

  
}
