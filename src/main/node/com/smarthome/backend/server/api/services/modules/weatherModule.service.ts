import { Router } from "express";
import { WeatherModuleManager } from "../../modules/weather/weatherModuleManager.js";
import { logger } from "../../../../logger.js";
import { DeviceWeather, DEFAULT_WEATHER_DEVICE_ID } from "../../../../model/devices/DeviceWeather.js";
import type { ServerDeps } from "../../server.js";
import { WeatherDevice } from "../../modules/weather/devices/WeatherDevice.js";
import { WEATHERMODULE } from "../../modules/weather/weatherModule.js";

function getWeatherDevice(deps: ServerDeps): DeviceWeather | null {
  const d = deps.deviceManager.getDevice(DEFAULT_WEATHER_DEVICE_ID);
  return d?.moduleId === WEATHERMODULE.id ? (d as WeatherDevice) : null;
}

/** Entfernt verwaiste Weather-Geräte (falsche ID); es gibt nur {@link DEFAULT_WEATHER_DEVICE_ID}. */
function removeStrayWeatherDevices(deps: ServerDeps): void {
  for (const d of deps.deviceManager.getDevicesForModule(WEATHERMODULE.id)) {
    if (d.id !== DEFAULT_WEATHER_DEVICE_ID) {
      deps.deviceManager.removeDevice(d.id);
    }
  }
}

/**
 * Stellt sicher, dass genau ein zentrales Wetter-Gerät ({@link DEFAULT_WEATHER_DEVICE_ID}) existiert.
 */
export function ensureWeatherDevice(deps: ServerDeps): void {
  removeStrayWeatherDevices(deps);
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
  const device = new WeatherDevice({
    id: DEFAULT_WEATHER_DEVICE_ID,
    name: WEATHERMODULE.name,
    moduleId: WEATHERMODULE.id,
    latitude: 52.52,
    longitude: 13.41,
    isConnected: true,
    quickAccess: true,
  });
  deps.deviceManager.saveDevice(device);
  deps.deviceManager.restartEventStreamForModule(WEATHERMODULE.id);
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
      if (deviceId !== DEFAULT_WEATHER_DEVICE_ID) {
        res.status(404).json({ error: "Weather-Gerät nicht gefunden" });
        return;
      }
      const device = deps.deviceManager.getDevice(deviceId);
      if (!device || device.moduleId !== WEATHERMODULE.id) {
        res.status(404).json({ error: "Weather-Gerät nicht gefunden" });
        return;
      }
      device.updateValues();
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
      if (deviceId !== DEFAULT_WEATHER_DEVICE_ID) {
        res.status(404).json({ error: "Weather-Gerät nicht gefunden" });
        return;
      }
      const { latitude, longitude } = req.body as { latitude?: number; longitude?: number };

      const device = deps.deviceManager.getDevice(deviceId);
      if (!device || device.moduleId !== WEATHERMODULE.id) {
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
