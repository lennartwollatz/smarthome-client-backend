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

  // Manuelles Hinzufügen per IP und Token (nur bei erfolgreichem miio-Pairing)
  router.post("/devices/add", async (req, res) => {
    const { ipAddress, token } = req.body ?? {};
    if (!ipAddress || !token) {
      res.status(400).json({
        error: "IP-Adresse und Token sind erforderlich",
        details: "Bitte gib ipAddress und token im Request-Body an."
      });
      return;
    }
    try {
      const device = await xiaomiModule.addDeviceByIpAndToken(
        String(ipAddress).trim(),
        String(token).trim()
      );
      res.status(201).json(device);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fehler beim Hinzufuegen des Geraets";
      logger.error({ error }, "Fehler beim manuellen Hinzufuegen eines Xiaomi-Geraets");
      res.status(400).json({ error: message });
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

  // Raum-Mapping abfragen
  router.get("/devices/:deviceId/roomMapping", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const rooms = await xiaomiModule.getRoomMapping(deviceId);
      res.status(200).json(rooms);
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler beim Abrufen des Raum-Mappings");
      res.status(500).json({ error: "Fehler beim Abrufen des Raum-Mappings" });
    }
  });

  // Staubsauger zu Raum navigieren (für Raumzuordnung)
  router.post("/devices/:deviceId/navigateToRoom", async (req, res) => {
    const deviceId = req.params.deviceId;
    const { roomId } = req.body ?? {};
    if (!deviceId || roomId === undefined || roomId === null) {
      res.status(400).json({ error: "deviceId und roomId sind erforderlich" });
      return;
    }
    try {
      const result = await xiaomiModule.navigateToRoom(deviceId, Number(roomId));
      res.status(200).json(result);
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler beim Navigieren zum Raum");
      res.status(500).json({ error: "Fehler beim Navigieren zum Raum" });
    }
  });

  return router;
}

