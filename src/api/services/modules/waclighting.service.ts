import { logger } from "../../../config/logger.js";
import type { WACLightingModuleManager } from "../../../modules/waclighting/waclightingModuleManager.js";
import type { Request_WaclightingDiscoverDevices } from "../../../model/requests/Request_WaclightingDiscoverDevices.js";
import type { Request_WaclightingFanSetOff } from "../../../model/requests/Request_WaclightingFanSetOff.js";
import type { Request_WaclightingFanSetOn } from "../../../model/requests/Request_WaclightingFanSetOn.js";
import type { Request_WaclightingFanSetSpeed } from "../../../model/requests/Request_WaclightingFanSetSpeed.js";
import type { Request_WaclightingLightSetBrightness } from "../../../model/requests/Request_WaclightingLightSetBrightness.js";
import type { Request_WaclightingLightSetOff } from "../../../model/requests/Request_WaclightingLightSetOff.js";
import type { Request_WaclightingLightSetOn } from "../../../model/requests/Request_WaclightingLightSetOn.js";
import { Response_WaclightingDiscoverDevices } from "../../../model/responses/Response_WaclightingDiscoverDevices.js";
import { Response_WaclightingFanSetOff } from "../../../model/responses/Response_WaclightingFanSetOff.js";
import { Response_WaclightingFanSetOn } from "../../../model/responses/Response_WaclightingFanSetOn.js";
import { Response_WaclightingFanSetSpeed } from "../../../model/responses/Response_WaclightingFanSetSpeed.js";
import { Response_WaclightingLightSetBrightness } from "../../../model/responses/Response_WaclightingLightSetBrightness.js";
import { Response_WaclightingLightSetOff } from "../../../model/responses/Response_WaclightingLightSetOff.js";
import { Response_WaclightingLightSetOn } from "../../../model/responses/Response_WaclightingLightSetOn.js";
import { ApiError } from "../../http/ApiError.js";

const DEVICE_NOT_FOUND = "Gerät nicht gefunden";

export class WaclightingService {
  constructor(private readonly wacLightingModule: WACLightingModuleManager) {}

  async discoverDevices(_request: Request_WaclightingDiscoverDevices): Promise<Response_WaclightingDiscoverDevices> {
    const devices = await this.execute("Fehler beim Discover von WAC Lighting-Geräten", () =>
      this.wacLightingModule.discoverDevices()
    );
    return new Response_WaclightingDiscoverDevices(devices);
  }

  async fanSetOn(request: Request_WaclightingFanSetOn): Promise<Response_WaclightingFanSetOn> {
    await this.control("Fehler beim Einschalten des Ventilators", () =>
      this.wacLightingModule.setFanOn(request.deviceId)
    );
    return new Response_WaclightingFanSetOn();
  }

  async fanSetOff(request: Request_WaclightingFanSetOff): Promise<Response_WaclightingFanSetOff> {
    await this.control("Fehler beim Ausschalten des Ventilators", () =>
      this.wacLightingModule.setFanOff(request.deviceId)
    );
    return new Response_WaclightingFanSetOff();
  }

  async fanSetSpeed(request: Request_WaclightingFanSetSpeed): Promise<Response_WaclightingFanSetSpeed> {
    const { deviceId, speed } = request;
    if (speed == null) throw ApiError.badRequest("Speed-Parameter fehlt (0-100)");
    if (speed < 0 || speed > 100) throw ApiError.badRequest("Speed muss zwischen 0 und 100 liegen");
    await this.control("Fehler beim Setzen der Ventilator-Geschwindigkeit", () =>
      this.wacLightingModule.setFanSpeed(deviceId, speed)
    );
    return new Response_WaclightingFanSetSpeed();
  }

  async lightSetOn(request: Request_WaclightingLightSetOn): Promise<Response_WaclightingLightSetOn> {
    await this.control("Fehler beim Einschalten des Lichts", () =>
      this.wacLightingModule.setLightOn(request.deviceId)
    );
    return new Response_WaclightingLightSetOn();
  }

  async lightSetOff(request: Request_WaclightingLightSetOff): Promise<Response_WaclightingLightSetOff> {
    await this.control("Fehler beim Ausschalten des Lichts", () =>
      this.wacLightingModule.setLightOff(request.deviceId)
    );
    return new Response_WaclightingLightSetOff();
  }

  async lightSetBrightness(
    request: Request_WaclightingLightSetBrightness
  ): Promise<Response_WaclightingLightSetBrightness> {
    const { deviceId, brightness } = request;
    if (brightness == null) throw ApiError.badRequest("Brightness-Parameter fehlt (0-100)");
    if (brightness < 0 || brightness > 100) throw ApiError.badRequest("Brightness muss zwischen 0 und 100 liegen");
    await this.control("Fehler beim Setzen der Licht-Helligkeit", () =>
      this.wacLightingModule.setLightBrightness(deviceId, brightness)
    );
    return new Response_WaclightingLightSetBrightness();
  }

  /** Ausnahmen des Moduls werden protokolliert und als 500 mit `errorMessage` gemeldet. */
  private async execute<T>(errorMessage: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (err) {
      logger.error({ err }, errorMessage);
      throw ApiError.internal(errorMessage);
    }
  }

  /** Gerätesteuerung: `false` vom Modul → 404, Ausnahme → 500. */
  private async control(errorMessage: string, action: () => Promise<boolean>): Promise<void> {
    if (!(await this.execute(errorMessage, action))) throw ApiError.notFound(DEVICE_NOT_FOUND);
  }
}
