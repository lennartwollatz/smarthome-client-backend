import { Router } from "express";
import type { DatabaseManager } from "../../../db/database.js";
import type { EventStreamManager } from "../../../events/eventStreamManager.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { HueModuleManager } from "../../modules/hue/hueModuleManager.js";
import { logger } from "../../../../logger.js";

type Deps = {
  databaseManager: DatabaseManager;
  eventStreamManager: EventStreamManager;
  actionManager: ActionManager;
};

export function createHueModuleRouter(deps: Deps) {
  const router = Router();
  const hueModule = new HueModuleManager(deps.databaseManager, deps.eventStreamManager, deps.actionManager);

  const handleSetSensitivity = (req: { params: { deviceId: string }; body?: any }, res: any) => {
    try {
      logger.info("Setze Sensitivity fuer Hue Motion Sensor: {}", req.params.deviceId);
      const rawSensitivity = (req.body ?? {}).sensitivity;
      let sensitivity: number | null = null;
      if (typeof rawSensitivity === "number") {
        sensitivity = rawSensitivity;
      } else if (typeof rawSensitivity === "string" && rawSensitivity.trim().length > 0) {
        const parsed = Number(rawSensitivity);
        if (!Number.isNaN(parsed)) sensitivity = parsed;
      }
      if (sensitivity == null) {
        res.status(400).json({ error: "sensitivity parameter is required" });
        return;
      }
      const success = hueModule.setSensitivity(req.params.deviceId, sensitivity);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Sensitivity");
      res.status(400).json({ error: "Invalid request" });
    }
  };

  const handleSetOn = (req: { params: { deviceId: string } }, res: any) => {
    try {
      logger.info("Schalte Hue Light ein: {}", req.params.deviceId);
      const success = hueModule.setOn(req.params.deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden oder nicht unterstützt" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Einschalten des Hue Light");
      res.status(400).json({ error: "Invalid request" });
    }
  };

  const handleSetOff = (req: { params: { deviceId: string } }, res: any) => {
    try {
      logger.info("Schalte Hue Light aus: {}", req.params.deviceId);
      const success = hueModule.setOff(req.params.deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden oder nicht unterstützt" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Ausschalten des Hue Light");
      res.status(400).json({ error: "Invalid request" });
    }
  };

  const handleSetBrightness = (req: { params: { deviceId: string }; body?: any }, res: any) => {
    try {
      logger.info("Setze Helligkeit fuer Hue Light: {}", req.params.deviceId);
      const rawBrightness = (req.body ?? {}).brightness;
      let brightness: number | null = null;
      if (typeof rawBrightness === "number") {
        brightness = rawBrightness;
      } else if (typeof rawBrightness === "string" && rawBrightness.trim().length > 0) {
        const parsed = Number(rawBrightness);
        if (!Number.isNaN(parsed)) brightness = parsed;
      }
      if (brightness == null) {
        res.status(400).json({ error: "brightness parameter is required" });
        return;
      }
      const success = hueModule.setBrightness(req.params.deviceId, brightness);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden oder nicht unterstützt" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Helligkeit");
      res.status(400).json({ error: "Invalid request" });
    }
  };

  const handleSetTemperature = (req: { params: { deviceId: string }; body?: any }, res: any) => {
    try {
      logger.info("Setze Farbtemperatur fuer Hue Light: {}", req.params.deviceId);
      const rawTemperature = (req.body ?? {}).temperature;
      let temperature: number | null = null;
      if (typeof rawTemperature === "number") {
        temperature = rawTemperature;
      } else if (typeof rawTemperature === "string" && rawTemperature.trim().length > 0) {
        const parsed = Number(rawTemperature);
        if (!Number.isNaN(parsed)) temperature = parsed;
      }
      if (temperature == null) {
        res.status(400).json({ error: "temperature parameter is required" });
        return;
      }
      const success = hueModule.setTemperature(req.params.deviceId, temperature);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden oder nicht unterstützt" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Farbtemperatur");
      res.status(400).json({ error: "Invalid request" });
    }
  };

  const handleSetColor = (req: { params: { deviceId: string }; body?: any }, res: any) => {
    try {
      logger.info("Setze Farbe fuer Hue Light: {}", req.params.deviceId);
      const rawX = (req.body ?? {}).x;
      const rawY = (req.body ?? {}).y;
      let x: number | null = null;
      let y: number | null = null;
      if (typeof rawX === "number") {
        x = rawX;
      } else if (typeof rawX === "string" && rawX.trim().length > 0) {
        const parsed = Number(rawX);
        if (!Number.isNaN(parsed)) x = parsed;
      }
      if (typeof rawY === "number") {
        y = rawY;
      } else if (typeof rawY === "string" && rawY.trim().length > 0) {
        const parsed = Number(rawY);
        if (!Number.isNaN(parsed)) y = parsed;
      }
      if (x == null || y == null) {
        res.status(400).json({ error: "x and y parameters are required" });
        return;
      }
      if (x < 0 || x > 1 || y < 0 || y > 1) {
        res.status(400).json({ error: "x and y must be between 0.0 and 1.0" });
        return;
      }
      const roundedX = Math.round(x * 1000) / 1000;
      const roundedY = Math.round(y * 1000) / 1000;
      const success = hueModule.setColor(req.params.deviceId, roundedX, roundedY);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden oder nicht unterstützt" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Farbe");
      res.status(400).json({ error: "Invalid request" });
    }
  };

  router.get("/bridges/discover", async (_req, res) => {
    try {
      const bridges = await hueModule.discoverBridges();
      res.status(200).json(bridges);
    } catch (error) {
      logger.error({ error }, "Fehler beim Discover von Hue-Bridges");
      res.status(500).json({ error: "Fehler beim Discover von Hue-Bridges" });
    }
  });

  router.post("/bridges/:bridgeId/pair", async (req, res) => {
    try {
      const result = await hueModule.pairBridge(req.params.bridgeId, req.body ?? {});
      res.status(result ? 200 : 404).json(result ? { success: true } : { error: "Bridge nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Pairing der Hue-Bridge");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.get("/discover/devices/:bridgeId", async (req, res) => {
    try {
      const devices = await hueModule.discoverDevices(req.params.bridgeId);
      res.status(200).json(devices);
    } catch (error) {
      logger.error({ error }, "Fehler beim Discover von Hue-Geraeten");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/setSensitivity", handleSetSensitivity);
  router.put("/devices/:deviceId/setSensitivity", handleSetSensitivity);

  router.post("/devices/:deviceId/setOn", handleSetOn);
  router.put("/devices/:deviceId/setOn", handleSetOn);

  router.post("/devices/:deviceId/setOff", handleSetOff);
  router.put("/devices/:deviceId/setOff", handleSetOff);

  router.post("/devices/:deviceId/setBrightness", handleSetBrightness);
  router.put("/devices/:deviceId/setBrightness", handleSetBrightness);

  router.post("/devices/:deviceId/setTemperature", handleSetTemperature);
  router.put("/devices/:deviceId/setTemperature", handleSetTemperature);

  router.post("/devices/:deviceId/setColor", handleSetColor);
  router.put("/devices/:deviceId/setColor", handleSetColor);

  return router;
}

