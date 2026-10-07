import { logger } from "../../../config/logger.js";
import type { TemperatureSchedule } from "../../../model/devices/DeviceThermostat.js";
import type { MatterModuleManager } from "../../../modules/matter/matterModuleManager.js";
import type { Request_MatterDiscoverDevices } from "../../../model/requests/Request_MatterDiscoverDevices.js";
import type { Request_MatterPairDevice } from "../../../model/requests/Request_MatterPairDevice.js";
import type { Request_MatterPairDeviceByCode } from "../../../model/requests/Request_MatterPairDeviceByCode.js";
import type { Request_MatterSetIntensity } from "../../../model/requests/Request_MatterSetIntensity.js";
import type { Request_MatterSetOff } from "../../../model/requests/Request_MatterSetOff.js";
import type { Request_MatterSetOn } from "../../../model/requests/Request_MatterSetOn.js";
import type { Request_MatterSetTemperature } from "../../../model/requests/Request_MatterSetTemperature.js";
import type { Request_MatterSetTemperatureSchedules } from "../../../model/requests/Request_MatterSetTemperatureSchedules.js";
import type { Request_MatterToggle } from "../../../model/requests/Request_MatterToggle.js";
import { Response_Failure } from "../../../model/responses/Response_Failure.js";
import { Response_MatterDiscoverDevices } from "../../../model/responses/Response_MatterDiscoverDevices.js";
import { Response_MatterPairDevice } from "../../../model/responses/Response_MatterPairDevice.js";
import { Response_MatterPairDeviceByCode } from "../../../model/responses/Response_MatterPairDeviceByCode.js";
import { Response_MatterSetIntensity } from "../../../model/responses/Response_MatterSetIntensity.js";
import { Response_MatterSetOff } from "../../../model/responses/Response_MatterSetOff.js";
import { Response_MatterSetOn } from "../../../model/responses/Response_MatterSetOn.js";
import { Response_MatterSetTemperature } from "../../../model/responses/Response_MatterSetTemperature.js";
import { Response_MatterSetTemperatureSchedules } from "../../../model/responses/Response_MatterSetTemperatureSchedules.js";
import { Response_MatterToggle } from "../../../model/responses/Response_MatterToggle.js";
import { ApiError } from "../../http/ApiError.js";

const DISCOVERY_FAILED = "Fehler beim Discover von Matter-Geraeten";
const PAIRING_FAILED = "Gerät nicht gefunden oder Pairing fehlgeschlagen";
const INVALID_REQUEST = "Invalid request";

export class MatterService {
  constructor(private readonly matterModule: MatterModuleManager) {}

  async discoverDevices(_request: Request_MatterDiscoverDevices): Promise<Response_MatterDiscoverDevices> {
    const devices = await rethrowAs(() => ApiError.internal(DISCOVERY_FAILED), DISCOVERY_FAILED, () =>
      this.matterModule.discoverDevices()
    );
    return new Response_MatterDiscoverDevices(devices);
  }

  async pairDevice(request: Request_MatterPairDevice): Promise<Response_MatterPairDevice> {
    const result = await rethrowAs(invalidRequest, "Fehler beim Pairing des Matter-Geraets", () =>
      this.matterModule.pairDevice(request.deviceId, { pairingCode: request.pairingCode })
    );
    if (!result.success) throw new ApiError(404, new Response_Failure(result.error ?? PAIRING_FAILED));
    return new Response_MatterPairDevice(result.nodeId, result.deviceId);
  }

  async pairDeviceByCode(request: Request_MatterPairDeviceByCode): Promise<Response_MatterPairDeviceByCode> {
    const result = await rethrowAs(invalidRequest, "Fehler beim Pairing by Code des Matter-Geraets", () =>
      this.matterModule.pairDeviceByCode({ pairingCode: request.pairingCode })
    );
    if (!result.success) throw new ApiError(404, new Response_Failure(result.error ?? PAIRING_FAILED));
    return new Response_MatterPairDeviceByCode(result.nodeId, result.deviceId);
  }

  async toggle(request: Request_MatterToggle): Promise<Response_MatterToggle> {
    await this.control("Fehler beim Toggle eines Matter-Buttons", () =>
      this.matterModule.toggle(request.deviceId, request.buttonId)
    );
    return new Response_MatterToggle();
  }

  async setOn(request: Request_MatterSetOn): Promise<Response_MatterSetOn> {
    await this.control("Fehler beim Setzen des On-Zustands eines Matter-Buttons", () =>
      this.matterModule.setOn(request.deviceId, request.buttonId)
    );
    return new Response_MatterSetOn();
  }

  async setOff(request: Request_MatterSetOff): Promise<Response_MatterSetOff> {
    await this.control("Fehler beim Setzen des Off-Zustands eines Matter-Buttons", () =>
      this.matterModule.setOff(request.deviceId, request.buttonId)
    );
    return new Response_MatterSetOff();
  }

  async setIntensity(request: Request_MatterSetIntensity): Promise<Response_MatterSetIntensity> {
    await this.control("Fehler beim Setzen der Intensität eines Matter-Buttons", () =>
      this.matterModule.setIntensity(request.deviceId, request.buttonId, request.intensity ?? 0)
    );
    return new Response_MatterSetIntensity();
  }

  async setTemperature(request: Request_MatterSetTemperature): Promise<Response_MatterSetTemperature> {
    const temperature = request.temperature ?? request.temperatureGoal;
    if (temperature == null) throw new ApiError(400, new Response_Failure());
    await this.control("Fehler beim Setzen der Temperatur eines Matter-Thermostats", () =>
      this.matterModule.setTemperatureGoal(request.deviceId, temperature)
    );
    return new Response_MatterSetTemperature();
  }

  async setTemperatureSchedules(
    request: Request_MatterSetTemperatureSchedules
  ): Promise<Response_MatterSetTemperatureSchedules> {
    const temperatureSchedules: TemperatureSchedule[] = (request.temperatureSchedules ?? []).map(schedule => ({
      rulename: schedule.rulename,
      rulevalue: schedule.rulevalue.map(({ weekday, time, temperature }) => ({ weekday, time, temperature })),
      active: schedule.active
    }));
    await this.control("Fehler beim Setzen der Temperatur-Schedules eines Matter-Thermostats", () =>
      this.matterModule.setTemperatureSchedules(request.deviceId, temperatureSchedules)
    );
    return new Response_MatterSetTemperatureSchedules();
  }

  /** Fehler der Aktion → 400 `Invalid request`, Ergebnis `false` → 400 `{ success: false }`. */
  private async control(logMessage: string, action: () => Promise<boolean>): Promise<void> {
    if (!(await rethrowAs(invalidRequest, logMessage, action))) throw new ApiError(400, new Response_Failure());
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
