import type { DeviceWeather } from "../devices/DeviceWeather.js";

/** POST /api/modules/weather/devices/:deviceId/refresh – Antwort ist das aktualisierte Wetter-Gerät. */
export class Response_WeatherRefreshDevice {
  constructor(readonly device: DeviceWeather) {}

  toJSON(): Record<string, unknown> {
    return this.device.toJSON();
  }
}
