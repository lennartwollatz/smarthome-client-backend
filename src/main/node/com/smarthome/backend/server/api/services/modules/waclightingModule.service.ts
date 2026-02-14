import { Router } from "express";
import type { DatabaseManager } from "../../../db/database.js";
import type { EventStreamManager } from "../../../events/eventStreamManager.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { WACLightingModuleManager } from "../../modules/waclighting/waclightingModuleManager.js";
import { WACLightingDeviceDiscover } from "../../modules/waclighting/waclightingDeviceDiscover.js";
import { logger } from "../../../../logger.js";

type Deps = {
  databaseManager: DatabaseManager;
  eventStreamManager: EventStreamManager;
  actionManager: ActionManager;
};

// Konkrete Implementierung des abstrakten WACLightingModuleManager
class WACLightingModuleManagerImpl extends WACLightingModuleManager {
  constructor(databaseManager: DatabaseManager, actionManager: ActionManager, eventStreamManager: EventStreamManager) {
    const deviceDiscover = new WACLightingDeviceDiscover(databaseManager);
    super(databaseManager, actionManager, eventStreamManager, deviceDiscover);
  }
}

export function createWACLightingModuleRouter(deps: Deps) {
  const router = Router();
  const wacLightingModule = new WACLightingModuleManagerImpl(
    deps.databaseManager,
    deps.actionManager,
    deps.eventStreamManager
  );
  deps.actionManager.registerModuleManager(wacLightingModule);

  router.get("/devices/discover", async (_req, res) => {
    try {
      const devices = await wacLightingModule.discoverDevices();
      res.status(200).json(devices);
    } catch (error) {
      logger.error({ error }, "Fehler beim Discover von WAC Lighting-Geräten");
      res.status(500).json({ error: "Fehler beim Discover von WAC Lighting-Geräten" });
    }
  });

  // Fan-Steuerung
  router.post("/devices/:deviceId/fan/setOn", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const success = await wacLightingModule.setFanOn(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Einschalten des Ventilators");
      res.status(500).json({ error: "Fehler beim Einschalten des Ventilators" });
    }
  });

  router.post("/devices/:deviceId/fan/setOff", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const success = await wacLightingModule.setFanOff(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Ausschalten des Ventilators");
      res.status(500).json({ error: "Fehler beim Ausschalten des Ventilators" });
    }
  });

  router.post("/devices/:deviceId/fan/setSpeed", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const rawSpeed = (req.body ?? {}).speed;
      let speed: number | null = null;
      if (typeof rawSpeed === "number") {
        speed = rawSpeed;
      } else if (typeof rawSpeed === "string" && rawSpeed.trim().length > 0) {
        const parsed = Number(rawSpeed);
        if (!Number.isNaN(parsed)) speed = parsed;
      }
      if (speed == null) {
        res.status(400).json({ error: "Speed-Parameter fehlt (0-100)" });
        return;
      }
      if (speed < 0 || speed > 100) {
        res.status(400).json({ error: "Speed muss zwischen 0 und 100 liegen" });
        return;
      }
      const success = await wacLightingModule.setFanSpeed(deviceId, speed);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Ventilator-Geschwindigkeit");
      res.status(500).json({ error: "Fehler beim Setzen der Ventilator-Geschwindigkeit" });
    }
  });

  // Light-Steuerung
  router.post("/devices/:deviceId/light/setOn", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const success = await wacLightingModule.setLightOn(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Einschalten des Lichts");
      res.status(500).json({ error: "Fehler beim Einschalten des Lichts" });
    }
  });

  router.post("/devices/:deviceId/light/setOff", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const success = await wacLightingModule.setLightOff(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Ausschalten des Lichts");
      res.status(500).json({ error: "Fehler beim Ausschalten des Lichts" });
    }
  });

  router.post("/devices/:deviceId/light/setBrightness", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const rawBrightness = (req.body ?? {}).brightness;
      let brightness: number | null = null;
      if (typeof rawBrightness === "number") {
        brightness = rawBrightness;
      } else if (typeof rawBrightness === "string" && rawBrightness.trim().length > 0) {
        const parsed = Number(rawBrightness);
        if (!Number.isNaN(parsed)) brightness = parsed;
      }
      if (brightness == null) {
        res.status(400).json({ error: "Brightness-Parameter fehlt (0-100)" });
        return;
      }
      if (brightness < 0 || brightness > 100) {
        res.status(400).json({ error: "Brightness muss zwischen 0 und 100 liegen" });
        return;
      }
      const success = await wacLightingModule.setLightBrightness(deviceId, brightness);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Licht-Helligkeit");
      res.status(500).json({ error: "Fehler beim Setzen der Licht-Helligkeit" });
    }
  });

  return router;
}

