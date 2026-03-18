import { Router } from "express";
import { WeatherModuleManager } from "../../modules/weather/weatherModuleManager.js";
import { logger } from "../../../../logger.js";
import type { RouterDeps } from "../../router.js";

export function createWeatherModuleRouter(deps: RouterDeps) {
  const router = Router();
  const weatherModule = new WeatherModuleManager(
    deps.databaseManager,
    deps.actionManager,
    deps.eventManager
  );
  deps.actionManager.registerModuleManager(weatherModule);

  router.post("/devices/:deviceId/refresh", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      const device = deps.actionManager.getDevice(deviceId);
      if (!device || device.moduleId !== "weather") {
        res.status(404).json({ error: "Weather-Gerät nicht gefunden" });
        return;
      }
      const success = await weatherModule.refreshDevice(deviceId);
      if (!success) {
        res.status(500).json({ error: "Wetterdaten konnten nicht abgerufen werden" });
        return;
      }
      const updated = deps.actionManager.getDevice(deviceId);
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

      const device = deps.actionManager.getDevice(deviceId);
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

      deps.actionManager.saveDevice(device);
      res.status(200).json(device);
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Wetter-Koordinaten");
      res.status(500).json({ error: "Fehler beim Setzen der Koordinaten" });
    }
  });

  return router;
}
