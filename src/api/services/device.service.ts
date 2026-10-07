import type { ActionManager } from "../../actions/ActionManager.js";
import type { Device } from "../../model/devices/Device.js";
import type { Request_DeleteDevice } from "../../model/requests/Request_DeleteDevice.js";
import type { Request_GetDevices } from "../../model/requests/Request_GetDevices.js";
import type { Request_UpdateDevice } from "../../model/requests/Request_UpdateDevice.js";
import { Response_DeleteDevice } from "../../model/responses/Response_DeleteDevice.js";
import { Response_Device } from "../../model/responses/Response_Device.js";
import { Response_GetDevices } from "../../model/responses/Response_GetDevices.js";
import { Response_UpdateDevice } from "../../model/responses/Response_UpdateDevice.js";
import { ApiError } from "../http/ApiError.js";

const DEVICE_NOT_FOUND = "Device not found";
const VOICE_ASSISTANT_MODULE_ID = "voice-assistant";
const MIN_TEMPERATURE_GOAL = 5;
const MAX_TEMPERATURE_GOAL = 35;

/** Felder, die PUT /api/devices/:deviceId unabhängig vom Gerätetyp setzen darf. */
type PatchableDevice = Device & {
  icon?: string;
  typeLabel?: string;
  temperatureGoal?: number;
  latitude?: number;
  longitude?: number;
  roomMapping?: Record<string, string>;
  buttons?: Record<string, { name?: string; connectedToLight?: boolean }>;
};

export class DeviceService {
  constructor(private readonly actionManager: ActionManager) {}

  getDevices(_request: Request_GetDevices): Response_GetDevices {
    const devices = this.actionManager.getDevices().filter(device => device.moduleId !== VOICE_ASSISTANT_MODULE_ID);
    return new Response_GetDevices(devices.map(device => new Response_Device(device)));
  }

  deleteDevice(request: Request_DeleteDevice): Response_DeleteDevice {
    if (!this.actionManager.removeDevice(request.deviceId)) {
      throw ApiError.notFound(DEVICE_NOT_FOUND);
    }
    return new Response_DeleteDevice();
  }

  updateDevice(request: Request_UpdateDevice): Response_UpdateDevice {
    const device: PatchableDevice | null = this.actionManager.getDevice(request.deviceId);
    if (!device) throw ApiError.notFound(DEVICE_NOT_FOUND);

    if (request.name != null) device.name = request.name;
    if (request.room !== undefined) device.room = request.room ?? undefined;
    if (request.icon != null) device.icon = request.icon;
    if (request.typeLabel != null) device.typeLabel = request.typeLabel;
    if (request.quickAccess != null) device.quickAccess = request.quickAccess;
    if (request.temperatureGoal != null) {
      device.temperatureGoal = Math.max(MIN_TEMPERATURE_GOAL, Math.min(MAX_TEMPERATURE_GOAL, request.temperatureGoal));
    }
    if (request.latitude != null) device.latitude = request.latitude;
    if (request.longitude != null) device.longitude = request.longitude;
    if (request.roomMapping != null) device.roomMapping = request.roomMapping;
    if (request.buttons != null && device.buttons) {
      for (const [buttonId, buttonPatch] of Object.entries(request.buttons)) {
        const button = device.buttons[buttonId];
        if (!button) continue;
        if (buttonPatch.name != null) button.name = buttonPatch.name;
        if (buttonPatch.connectedToLight != null) button.connectedToLight = buttonPatch.connectedToLight;
      }
    }

    this.actionManager.saveDevice(device);
    return new Response_UpdateDevice(device);
  }
}
