import { Device } from "../../model/devices/Device.js";
import { DeviceType } from "../../model/devices/helper/DeviceType.js";
import { getDeviceMethodExact } from "../api/utils/deviceMethodInvoke.js";
import type { DeviceManager } from "../api/entities/devices/deviceManager.js";
import type { UserManager } from "../api/entities/users/userManager.js";
import type { ActionManager } from "../api/entities/actions/ActionManager.js";
import type { CatalogDevice, DeviceCatalog } from "./types.js";

/** Methoden, die für Automatisierungen typischerweise relevant sind. */
const RELEVANT_METHOD_PREFIXES = [
  "is",
  "set",
  "get",
  "has",
  "start",
  "stop",
  "turn",
  "temperature",
  "climate",
  "present",
  "absent",
  "power",
  "motion",
  "locked",
  "range",
];

function listWorkflowMethods(device: Device): string[] {
  const proto = Object.getPrototypeOf(device) as object;
  const names = new Set<string>();
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key === "constructor" || key.startsWith("_")) continue;
    if (getDeviceMethodExact(device, key)) {
      names.add(key);
    }
  }
  for (const key of Object.keys(device)) {
    if (getDeviceMethodExact(device, key)) {
      names.add(key);
    }
  }
  return [...names]
    .filter((n) => RELEVANT_METHOD_PREFIXES.some((p) => n.toLowerCase().startsWith(p.toLowerCase())))
    .sort();
}

function toCatalogDevice(device: Device): CatalogDevice {
  return {
    id: device.id,
    name: device.name ?? device.id,
    type: device.type ?? DeviceType.SENSOR,
    room: device.room,
    moduleId: device.moduleId,
    methods: listWorkflowMethods(device),
  };
}

function filterByType(devices: CatalogDevice[], ...types: string[]): CatalogDevice[] {
  const set = new Set(types);
  return devices.filter((d) => set.has(String(d.type)));
}

/** Baut den Gerätekatalog für Template- und LLM-Vorschläge. */
export function buildDeviceCatalog(
  deviceManager: DeviceManager,
  userManager: UserManager,
  actionManager: ActionManager
): DeviceCatalog {
  const devices = deviceManager.getDevices().map(toCatalogDevice);
  const users = userManager.findAll().map((u) => ({
    id: u.id,
    name: u.name ?? u.id,
    presenceDeviceId: u.presenceDeviceId || undefined,
  }));
  const existing = actionManager.getActions();
  return {
    devices,
    presenceDevices: filterByType(devices, DeviceType.PRESENCE),
    thermostats: filterByType(devices, DeviceType.THERMOSTAT),
    cars: filterByType(devices, DeviceType.CAR),
    motionSensors: filterByType(devices, DeviceType.MOTION, DeviceType.MOTION_LIGHT_LEVEL, DeviceType.MOTION_LIGHT_LEVEL_TEMPERATURE),
    lights: filterByType(devices, DeviceType.LIGHT, DeviceType.LIGHT_DIMMER, DeviceType.LIGHT_DIMMER_TEMPERATURE, DeviceType.LIGHT_DIMMER_TEMPERATURE_COLOR, DeviceType.SWITCH),
    users,
    existingAutomationNames: existing.map((a) => a.name),
    existingPatternTypes: existing
      .map((a) => a.aiPatternType)
      .filter((t): t is string => typeof t === "string" && t.length > 0),
  };
}

/** JSON für LLM-Prompt (kompakt). */
export function catalogToLlmJson(catalog: DeviceCatalog): string {
  return JSON.stringify(
    {
      users: catalog.users,
      devices: catalog.devices.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        room: d.room,
        methods: d.methods.slice(0, 12),
      })),
      existingPatternTypes: catalog.existingPatternTypes,
    },
    null,
    2
  );
}
