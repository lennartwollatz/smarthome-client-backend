import type { ActionManager } from "../../../actions/ActionManager.js";
import { logger } from "../../../config/logger.js";
import type { DeviceWeather } from "../../../model/devices/DeviceWeather.js";
import type { Request_WeatherRefreshDevice } from "../../../model/requests/Request_WeatherRefreshDevice.js";
import type { Request_WeatherUpdateCoordinates } from "../../../model/requests/Request_WeatherUpdateCoordinates.js";
import { Response_WeatherRefreshDevice } from "../../../model/responses/Response_WeatherRefreshDevice.js";
import { Response_WeatherUpdateCoordinates } from "../../../model/responses/Response_WeatherUpdateCoordinates.js";
import type { WeatherModuleManager } from "../../../modules/weather/weatherModuleManager.js";
import { ApiError } from "../../http/ApiError.js";

const WEATHER_DEVICE_NOT_FOUND = "Weather-Gerät nicht gefunden";

export class WeatherService {
  constructor(
    private readonly weatherModule: WeatherModuleManager,
    private readonly actionManager: ActionManager
  ) {}

  async refreshDevice(request: Request_WeatherRefreshDevice): Promise<Response_WeatherRefreshDevice> {
    const device = this.requireWeatherDevice(request.deviceId);
    let refreshed: boolean;
    try {
      refreshed = await this.weatherModule.refreshDevice(request.deviceId);
    } catch (err) {
      logger.error({ err }, "Fehler beim Aktualisieren der Wetterdaten");
      throw ApiError.internal("Fehler beim Aktualisieren der Wetterdaten");
    }
    if (!refreshed) throw ApiError.internal("Wetterdaten konnten nicht abgerufen werden");
    return new Response_WeatherRefreshDevice(device);
  }

  updateCoordinates(request: Request_WeatherUpdateCoordinates): Response_WeatherUpdateCoordinates {
    const device = this.requireWeatherDevice(request.deviceId);
    try {
      if (request.latitude != null) device.latitude = request.latitude;
      if (request.longitude != null) device.longitude = request.longitude;
      this.actionManager.saveDevice(device);
    } catch (err) {
      logger.error({ err }, "Fehler beim Setzen der Wetter-Koordinaten");
      throw ApiError.internal("Fehler beim Setzen der Koordinaten");
    }
    return new Response_WeatherUpdateCoordinates(device);
  }

  private requireWeatherDevice(deviceId: string): DeviceWeather {
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "weather") throw ApiError.notFound(WEATHER_DEVICE_NOT_FOUND);
    return device as DeviceWeather;
  }
}
