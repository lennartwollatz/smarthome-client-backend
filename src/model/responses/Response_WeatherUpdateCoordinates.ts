import type { DeviceWeather } from "../devices/DeviceWeather.js";

/** PUT /api/modules/weather/devices/:deviceId/coordinates – Antwort ist das geänderte Wetter-Gerät. */
export class Response_WeatherUpdateCoordinates {
  constructor(readonly device: DeviceWeather) {}

  toJSON(): Record<string, unknown> {
    return this.device.toJSON();
  }
}
