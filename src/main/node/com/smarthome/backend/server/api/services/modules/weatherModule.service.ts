import { Router } from "express";
import { WeatherModuleManager } from "../../modules/weather/weatherModuleManager.js";
import { logger } from "../../../../logger.js";
import { DeviceWeather, DEFAULT_WEATHER_DEVICE_ID } from "../../../../model/devices/DeviceWeather.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import type { ServerDeps } from "../../server.js";

function getWeatherDevice(deps: ServerDeps): DeviceWeather | null {
  const d = deps.deviceManager.getDevice(DEFAULT_WEATHER_DEVICE_ID);
  return d?.moduleId === "weather" ? (d as DeviceWeather) : null;
}

function listWeatherDevices(deps: ServerDeps): DeviceWeather[] {
  return deps.deviceManager
    .getDevicesForModule("weather")
    .filter((d): d is DeviceWeather => d.type === DeviceType.WEATHER);
}

/**
 * Fasst alle Weather-Geräte auf {@link DEFAULT_WEATHER_DEVICE_ID} zusammen und entfernt Duplikate.
 */
function consolidateWeatherDevicesToSingle(deps: ServerDeps): void {
  const list = listWeatherDevices(deps);
  if (list.length === 0) {
    return;
  }
  if (list.length === 1) {
    const only = list[0];
    if (only.id === DEFAULT_WEATHER_DEVICE_ID) {
      return;
    }
    const snapshot = only.toJSON() as Record<string, unknown>;
    deps.deviceManager.removeDevice(only.id);
    const canonical = new DeviceWeather({
      ...snapshot,
      id: DEFAULT_WEATHER_DEVICE_ID,
      moduleId: "weather",
    } as Partial<DeviceWeather>);
    deps.deviceManager.saveDevice(canonical);
    deps.deviceManager.restartEventStreamForModule("weather");
    return;
  }

  let canonical = list.find((d) => d.id === DEFAULT_WEATHER_DEVICE_ID);
  if (!canonical) {
    const withCoords = list.find(
      (d) => typeof d.latitude === "number" && typeof d.longitude === "number"
    );
    const best = withCoords ?? list[0];
    const snapshot = best.toJSON() as Record<string, unknown>;
    for (const d of list) {
      deps.deviceManager.removeDevice(d.id);
    }
    canonical = new DeviceWeather({
      ...snapshot,
      id: DEFAULT_WEATHER_DEVICE_ID,
      moduleId: "weather",
    } as Partial<DeviceWeather>);
    deps.deviceManager.saveDevice(canonical);
    deps.deviceManager.restartEventStreamForModule("weather");
    return;
  }

  for (const d of list) {
    if (d.id === DEFAULT_WEATHER_DEVICE_ID) {
      continue;
    }
    if (canonical.latitude === undefined && typeof d.latitude === "number") {
      canonical.latitude = d.latitude;
    }
    if (canonical.longitude === undefined && typeof d.longitude === "number") {
      canonical.longitude = d.longitude;
    }
    if (canonical.room === undefined && d.room) {
      canonical.room = d.room;
    }
    deps.deviceManager.removeDevice(d.id);
  }
  deps.deviceManager.saveDevice(canonical);
  deps.deviceManager.restartEventStreamForModule("weather");
}

/**
 * Stellt sicher, dass genau ein zentrales Wetter-Gerät existiert (wie {@link createCalendarModuleRouter} → ensureCalendarDevice).
 */
export function ensureWeatherDevice(deps: ServerDeps): void {
  consolidateWeatherDevicesToSingle(deps);
  const existing = getWeatherDevice(deps);
  if (existing) {
    let changed = false;
    if (!existing.isConnected) {
      existing.isConnected = true;
      changed = true;
    }
    if (!existing.quickAccess) {
      existing.quickAccess = true;
      changed = true;
    }
    if (changed) {
      deps.deviceManager.saveDevice(existing);
    }
    return;
  }
  const device = new DeviceWeather({
    id: DEFAULT_WEATHER_DEVICE_ID,
    name: "Wetter",
    moduleId: "weather",
    latitude: 52.52,
    longitude: 13.41,
    isConnected: true,
    quickAccess: true,
  });
  deps.deviceManager.saveDevice(device);
  deps.deviceManager.restartEventStreamForModule("weather");
}

export function createWeatherModuleRouter(deps: ServerDeps) {
  const router = Router();
  const weatherModule = new WeatherModuleManager(
    deps.databaseManager,
    deps.deviceManager,
    deps.eventManager
  );
  deps.deviceManager.registerModuleManager(weatherModule);

  ensureWeatherDevice(deps);

  router.post("/devices/:deviceId/refresh", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      const device = deps.deviceManager.getDevice(deviceId);
      if (!device || device.moduleId !== "weather") {
        res.status(404).json({ error: "Weather-Gerät nicht gefunden" });
        return;
      }
      const success = await weatherModule.refreshDevice(deviceId);
      if (!success) {
        res.status(500).json({ error: "Wetterdaten konnten nicht abgerufen werden" });
        return;
      }
      const updated = deps.deviceManager.getDevice(deviceId);
      res.status(200).json(updated);
    } catch (error) {
      logger.error({ error }, "Fehler beim Aktualisieren der Wetterdaten");
      res.status(500).json({ error: "Fehler beim Aktualisieren der Wetterdaten" });
    }
  });

  router.put("/devices/:deviceId/coordinates", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      const { latitude, longitude } = req.body as { latitude?: number; longitude?: number };

      const device = deps.deviceManager.getDevice(deviceId);
      if (!device || device.moduleId !== "weather") {
        res.status(404).json({ error: "Weather-Gerät nicht gefunden" });
        return;
      }

      if (typeof latitude === "number") {
        (device as { latitude?: number }).latitude = latitude;
      }
      if (typeof longitude === "number") {
        (device as { longitude?: number }).longitude = longitude;
      }

      deps.deviceManager.saveDevice(device);
      res.status(200).json(device);
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Wetter-Koordinaten");
      res.status(500).json({ error: "Fehler beim Setzen der Koordinaten" });
    }
  });

  return router;
}
