import { logger } from "../../../config/logger.js";
import type { HueModuleManager } from "../../../modules/hue/hueModuleManager.js";
import type { Request_HueDiscoverBridgeDevices } from "../../../model/requests/Request_HueDiscoverBridgeDevices.js";
import type { Request_HueDiscoverBridges } from "../../../model/requests/Request_HueDiscoverBridges.js";
import type { Request_HueGetBridges } from "../../../model/requests/Request_HueGetBridges.js";
import type { Request_HuePairBridge } from "../../../model/requests/Request_HuePairBridge.js";
import type { Request_HueSetBrightness } from "../../../model/requests/Request_HueSetBrightness.js";
import type { Request_HueSetColor } from "../../../model/requests/Request_HueSetColor.js";
import type { Request_HueSetOff } from "../../../model/requests/Request_HueSetOff.js";
import type { Request_HueSetOn } from "../../../model/requests/Request_HueSetOn.js";
import type { Request_HueSetSensitivity } from "../../../model/requests/Request_HueSetSensitivity.js";
import type { Request_HueSetTemperature } from "../../../model/requests/Request_HueSetTemperature.js";
import { Response_HueBridge } from "../../../model/responses/Response_HueBridge.js";
import { Response_HueDiscoverBridgeDevices } from "../../../model/responses/Response_HueDiscoverBridgeDevices.js";
import { Response_HueDiscoverBridges } from "../../../model/responses/Response_HueDiscoverBridges.js";
import { Response_HueGetBridges } from "../../../model/responses/Response_HueGetBridges.js";
import { Response_HuePairBridge } from "../../../model/responses/Response_HuePairBridge.js";
import { Response_HueSetBrightness } from "../../../model/responses/Response_HueSetBrightness.js";
import { Response_HueSetColor } from "../../../model/responses/Response_HueSetColor.js";
import { Response_HueSetOff } from "../../../model/responses/Response_HueSetOff.js";
import { Response_HueSetOn } from "../../../model/responses/Response_HueSetOn.js";
import { Response_HueSetSensitivity } from "../../../model/responses/Response_HueSetSensitivity.js";
import { Response_HueSetTemperature } from "../../../model/responses/Response_HueSetTemperature.js";
import { ApiError } from "../../http/ApiError.js";

const BRIDGE_DISCOVERY_FAILED = "Fehler beim Discover von Hue-Bridges";
const BRIDGE_NOT_FOUND = "Bridge nicht gefunden";
const DEVICE_NOT_FOUND = "Gerät nicht gefunden";
const DEVICE_UNAVAILABLE = "Gerät nicht gefunden oder nicht unterstützt";
const INVALID_REQUEST = "Invalid request";

export class HueService {
  constructor(private readonly hueModule: HueModuleManager) {}

  async getBridges(_request: Request_HueGetBridges): Promise<Response_HueGetBridges> {
    const bridges = await rethrowAs(
      () => ApiError.internal(BRIDGE_DISCOVERY_FAILED),
      "Fehler beim Laden der Hue-Bridges",
      () => this.hueModule.getBridges()
    );
    return new Response_HueGetBridges(bridges.map(bridge => new Response_HueBridge(bridge)));
  }

  async discoverBridges(_request: Request_HueDiscoverBridges): Promise<Response_HueDiscoverBridges> {
    const bridges = await rethrowAs(
      () => ApiError.internal(BRIDGE_DISCOVERY_FAILED),
      BRIDGE_DISCOVERY_FAILED,
      () => this.hueModule.discoverBridges()
    );
    return new Response_HueDiscoverBridges(bridges.map(bridge => new Response_HueBridge(bridge)));
  }

  async pairBridge(request: Request_HuePairBridge): Promise<Response_HuePairBridge> {
    await this.control("Fehler beim Pairing der Hue-Bridge", BRIDGE_NOT_FOUND, () =>
      this.hueModule.pairBridge(request.bridgeId, {})
    );
    return new Response_HuePairBridge();
  }

  async discoverBridgeDevices(request: Request_HueDiscoverBridgeDevices): Promise<Response_HueDiscoverBridgeDevices> {
    const devices = await rethrowAs(invalidRequest, "Fehler beim Discover von Hue-Geraeten", () =>
      this.hueModule.discoverDevicesForBridge(request.bridgeId)
    );
    return new Response_HueDiscoverBridgeDevices(devices);
  }

  async setSensitivity(request: Request_HueSetSensitivity): Promise<Response_HueSetSensitivity> {
    logger.info({ deviceId: request.deviceId }, "Setze Sensitivity fuer Hue Motion Sensor");
    const { sensitivity } = request;
    if (sensitivity == null) throw ApiError.badRequest("sensitivity parameter is required");
    await this.control("Fehler beim Setzen der Sensitivity", DEVICE_NOT_FOUND, () =>
      this.hueModule.setSensitivity(request.deviceId, sensitivity)
    );
    return new Response_HueSetSensitivity();
  }

  async setOn(request: Request_HueSetOn): Promise<Response_HueSetOn> {
    logger.info({ deviceId: request.deviceId }, "Schalte Hue Light ein");
    await this.control("Fehler beim Einschalten des Hue Light", DEVICE_UNAVAILABLE, () =>
      this.hueModule.setOn(request.deviceId)
    );
    return new Response_HueSetOn();
  }

  async setOff(request: Request_HueSetOff): Promise<Response_HueSetOff> {
    logger.info({ deviceId: request.deviceId }, "Schalte Hue Light aus");
    await this.control("Fehler beim Ausschalten des Hue Light", DEVICE_UNAVAILABLE, () =>
      this.hueModule.setOff(request.deviceId)
    );
    return new Response_HueSetOff();
  }

  async setBrightness(request: Request_HueSetBrightness): Promise<Response_HueSetBrightness> {
    logger.info({ deviceId: request.deviceId }, "Setze Helligkeit fuer Hue Light");
    const { brightness } = request;
    if (brightness == null) throw ApiError.badRequest("brightness parameter is required");
    await this.control("Fehler beim Setzen der Helligkeit", DEVICE_UNAVAILABLE, () =>
      this.hueModule.setBrightness(request.deviceId, brightness)
    );
    return new Response_HueSetBrightness();
  }

  async setTemperature(request: Request_HueSetTemperature): Promise<Response_HueSetTemperature> {
    logger.info({ deviceId: request.deviceId }, "Setze Farbtemperatur fuer Hue Light");
    const { temperature } = request;
    if (temperature == null) throw ApiError.badRequest("temperature parameter is required");
    await this.control("Fehler beim Setzen der Farbtemperatur", DEVICE_UNAVAILABLE, () =>
      this.hueModule.setTemperature(request.deviceId, temperature)
    );
    return new Response_HueSetTemperature();
  }

  async setColor(request: Request_HueSetColor): Promise<Response_HueSetColor> {
    logger.info({ deviceId: request.deviceId }, "Setze Farbe fuer Hue Light");
    const { x, y } = request;
    if (x == null || y == null) throw ApiError.badRequest("x and y parameters are required");
    if (x < 0 || x > 1 || y < 0 || y > 1) throw ApiError.badRequest("x and y must be between 0.0 and 1.0");
    const roundedX = Math.round(x * 1000) / 1000;
    const roundedY = Math.round(y * 1000) / 1000;
    await this.control("Fehler beim Setzen der Farbe", DEVICE_UNAVAILABLE, () =>
      this.hueModule.setColor(request.deviceId, roundedX, roundedY)
    );
    return new Response_HueSetColor();
  }

  /** Fehler der Aktion → 400 `Invalid request`, Ergebnis `false` → 404 mit `notFoundMessage`. */
  private async control(logMessage: string, notFoundMessage: string, action: () => Promise<boolean>): Promise<void> {
    if (!(await rethrowAs(invalidRequest, logMessage, action))) throw ApiError.notFound(notFoundMessage);
  }
}

function invalidRequest(): ApiError {
  return ApiError.badRequest(INVALID_REQUEST);
}

/** Führt `action` aus; Fehler werden geloggt und als `toError()` gemeldet. */
async function rethrowAs<T>(toError: () => ApiError, logMessage: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (err) {
    logger.error({ err }, logMessage);
    throw toError();
  }
}
