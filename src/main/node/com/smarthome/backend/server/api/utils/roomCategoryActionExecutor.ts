import { logger } from "../../../logger.js";
import { Device } from "../../../model/devices/Device.js";
import { DeviceType } from "../../../model/devices/helper/DeviceType.js";
import { ActionConfig } from "../entities/actions/action/ActionConfig.js";
import { invokeDeviceMethodOnDevice } from "./deviceMethodInvoke.js";

export type RoomCategory = "light" | "speaker" | "media" | "cleaner" | "fan";
export type RoomCommand = "on" | "off";

const LIGHT_TYPES = new Set<string>([
  DeviceType.LIGHT,
  DeviceType.LIGHT_DIMMER,
  DeviceType.LIGHT_DIMMER_TEMPERATURE,
  DeviceType.LIGHT_DIMMER_TEMPERATURE_COLOR,
]);

const SWITCH_TYPES = new Set<string>([
  DeviceType.SWITCH,
  DeviceType.SWITCH_DIMMER,
  DeviceType.SWITCH_ENERGY,
]);

const SPEAKER_TYPES = new Set<string>([
  DeviceType.SPEAKER,
  DeviceType.SPEAKER_RECEIVER,
  DeviceType.TV,
]);

const FAN_TYPES = new Set<string>([
  DeviceType.FAN,
  DeviceType.FAN_LIGHT,
  DeviceType.FAN_LIGHT_DIMMER,
]);

const VALID_CATEGORIES = new Set<string>(["light", "speaker", "media", "cleaner", "fan"]);

type SwitchButton = { connectedToLight?: boolean };

function isConnectedDevice(device: Device): boolean {
  return device.isConnected === true;
}

export function vacuumDeviceMapsToFloorPlanRoom(device: Device, floorPlanRoomId: string): boolean {
  const rid = String(floorPlanRoomId).trim();
  if (!rid || device.type !== DeviceType.VACUUM) {
    return false;
  }
  const mapping = (device as Device & { roomMapping?: Record<string, { id?: string }> }).roomMapping;
  if (!mapping || typeof mapping !== "object") {
    return false;
  }
  return Object.values(mapping).some(
    (entry) => entry != null && String(entry.id ?? "").trim() === rid
  );
}

export function resolveVacuumRoomIdsForStartCleaning(
  device: Device,
  floorPlanRoomIds: string[]
): string[] {
  const mapping = (device as Device & { roomMapping?: Record<string, { id?: string }> }).roomMapping;
  if (!mapping || typeof mapping !== "object" || Object.keys(mapping).length === 0) {
    return floorPlanRoomIds;
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const fpId of floorPlanRoomIds) {
    const rid = String(fpId).trim();
    if (!rid) continue;
    for (const [vacuumKey, entry] of Object.entries(mapping)) {
      if (entry != null && String(entry.id ?? "").trim() === rid && !seen.has(vacuumKey)) {
        seen.add(vacuumKey);
        out.push(vacuumKey);
      }
    }
  }
  return out.length > 0 ? out : floorPlanRoomIds;
}

function deviceInRoom(device: Device, roomId: string): boolean {
  return String(device.room ?? "").trim() === String(roomId).trim();
}

function switchHasLightButton(device: Device): boolean {
  const buttons = (device as Device & { buttons?: Record<string, SwitchButton> }).buttons;
  if (!buttons || typeof buttons !== "object") return false;
  return Object.values(buttons).some((b) => b?.connectedToLight === true);
}

function getLightConnectedButtonIds(device: Device): string[] {
  const buttons = (device as Device & { buttons?: Record<string, SwitchButton> }).buttons;
  if (!buttons || typeof buttons !== "object") return [];
  return Object.entries(buttons)
    .filter(([, b]) => b?.connectedToLight === true)
    .map(([id]) => id);
}

export function resolveDevicesForRoomCategory(
  devices: Iterable<Device>,
  roomId: string | undefined,
  category: RoomCategory
): Device[] {
  const scoped = [...devices].filter(isConnectedDevice);
  const rid = roomId != null ? String(roomId).trim() : "";
  const allRooms = rid === "";

  switch (category) {
    case "light":
      return scoped.filter((d) => {
        if (!allRooms && !deviceInRoom(d, rid)) return false;
        if (LIGHT_TYPES.has(String(d.type))) return true;
        return SWITCH_TYPES.has(String(d.type)) && switchHasLightButton(d);
      });
    case "speaker":
      return scoped.filter((d) => {
        if (!allRooms && !deviceInRoom(d, rid)) return false;
        return SPEAKER_TYPES.has(String(d.type));
      });
    case "media":
      return scoped.filter((d) => {
        if (!allRooms && !deviceInRoom(d, rid)) return false;
        return d.type === DeviceType.TV;
      });
    case "fan":
      return scoped.filter((d) => {
        if (!allRooms && !deviceInRoom(d, rid)) return false;
        return FAN_TYPES.has(String(d.type));
      });
    case "cleaner":
      return scoped.filter((d) => {
        if (d.type !== DeviceType.VACUUM) return false;
        if (allRooms) return true;
        return vacuumDeviceMapsToFloorPlanRoom(d, rid);
      });
    default:
      return [];
  }
}

async function invokeAndAwait(device: Device, methodName: string, values: unknown[] = []): Promise<void> {
  const raw = invokeDeviceMethodOnDevice(device, methodName, values);
  if (raw instanceof Promise) {
    await raw;
  }
}

async function applyLightCommand(device: Device, command: RoomCommand): Promise<void> {
  const type = String(device.type);
  /* Alle Licht-Typen (dimmer, Farbtemperatur, …) erben setOn/setOff von DeviceLight. */
  if (LIGHT_TYPES.has(type)) {
    await invokeAndAwait(device, command === "on" ? "setOn" : "setOff");
    return;
  }
  if (SWITCH_TYPES.has(type)) {
    const method = command === "on" ? "on" : "off";
    for (const buttonId of getLightConnectedButtonIds(device)) {
      await invokeAndAwait(device, method, [buttonId]);
    }
  }
}

async function applyCategoryToDevice(
  device: Device,
  category: RoomCategory,
  command: RoomCommand,
  floorPlanRoomId: string | undefined
): Promise<void> {
  switch (category) {
    case "light":
      await applyLightCommand(device, command);
      break;
    case "speaker":
      await invokeAndAwait(device, command === "on" ? "play" : "pause");
      break;
    case "media":
      await invokeAndAwait(device, command === "on" ? "setPowerOn" : "setPowerOff");
      break;
    case "fan":
      await invokeAndAwait(device, command === "on" ? "setOn" : "setOff");
      break;
    case "cleaner": {
      if (command === "off") {
        await invokeAndAwait(device, "stopCleaning");
        return;
      }
      const rid = floorPlanRoomId != null ? String(floorPlanRoomId).trim() : "";
      if (rid === "") {
        await invokeAndAwait(device, "startCleaning");
      } else {
        const mapped = resolveVacuumRoomIdsForStartCleaning(device, [rid]);
        await invokeAndAwait(device, "startCleaningRoom", [mapped]);
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Fuehrt eine Raum-Kategorie-Aktion auf allen passenden Geraeten aus.
 * @returns Warnungen (z. B. ungueltige Config, fehlende Geraete)
 */
export async function executeRoomCategoryAction(
  config: ActionConfig,
  devices: Map<string, Device>
): Promise<string[]> {
  const warnings: string[] = [];
  const category = String(config.roomCategory ?? "").trim() as RoomCategory;
  const command = String(config.roomCommand ?? "").trim() as RoomCommand;

  if (!VALID_CATEGORIES.has(category)) {
    warnings.push(`Ungueltige Raum-Kategorie: ${config.roomCategory ?? "(leer)"}`);
    return warnings;
  }
  if (command !== "on" && command !== "off") {
    warnings.push(`Ungueltiger Raum-Befehl: ${config.roomCommand ?? "(leer)"}`);
    return warnings;
  }

  const roomIdRaw = config.roomId != null ? String(config.roomId).trim() : "";
  const floorPlanRoomId = roomIdRaw === "" ? undefined : roomIdRaw;

  const targets = resolveDevicesForRoomCategory(devices.values(), floorPlanRoomId, category);
  if (targets.length === 0) {
    warnings.push(
      floorPlanRoomId
        ? `Keine Geraete fuer Kategorie ${category} im Raum ${floorPlanRoomId}`
        : `Keine Geraete fuer Kategorie ${category} (alle Raeume)`
    );
    return warnings;
  }

  for (const device of targets) {
    try {
      await applyCategoryToDevice(device, category, command, floorPlanRoomId);
    } catch (err) {
      logger.error(
        { err, deviceId: device.id, category, command },
        "roomCategoryActionExecutor: Fehler bei Geraet"
      );
      warnings.push(`Fehler bei Geraet ${device.id}`);
    }
  }

  return warnings;
}
