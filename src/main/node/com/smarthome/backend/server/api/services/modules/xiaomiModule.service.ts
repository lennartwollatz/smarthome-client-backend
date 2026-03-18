import { Router } from "express";
import { logger } from "../../../../logger.js";
import type { RouterDeps } from "../../router.js";
import { XiaomiModuleManager } from "../../modules/xiaomi/xiaomiModuleManager.js";

export function createXiaomiModuleRouter(deps: RouterDeps) {
  const router = Router();
  const xiaomiModule = new XiaomiModuleManager(
    deps.databaseManager,
    deps.actionManager,
    deps.eventManager
  );
  deps.actionManager.registerModuleManager(xiaomiModule);

  // Discovery: Liefert gefundene Xiaomi-Staubsauger zurück
  router.get("/devices/discover", async (_req, res) => {
    try {
      const devices = await xiaomiModule.discoverDevices();
      res.status(200).json(devices);
    } catch (error) {
      logger.error({ error }, "Fehler beim Discover von Xiaomi-Geraeten");
      res.status(500).json({ error: "Fehler beim Discover von Xiaomi-Geraeten" });
    }
  });

  // Staubsauger starten
  router.post("/devices/:deviceId/startCleaning", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const success = await xiaomiModule.startCleaning(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler beim Starten der Reinigung");
      res.status(500).json({ error: "Fehler beim Starten der Reinigung" });
    }
  });

  // Staubsauger stoppen
  router.post("/devices/:deviceId/stopCleaning", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const success = await xiaomiModule.stopCleaning(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler beim Stoppen der Reinigung");
      res.status(500).json({ error: "Fehler beim Stoppen der Reinigung" });
    }
  });

  // Staubsauger zur Docking-Station schicken
  router.post("/devices/:deviceId/dock", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const success = await xiaomiModule.dock(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler beim Senden zur Docking-Station");
      res.status(500).json({ error: "Fehler beim Senden zur Docking-Station" });
    }
  });

  return router;
}

