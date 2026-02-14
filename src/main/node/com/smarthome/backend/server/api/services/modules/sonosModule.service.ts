import { Router } from "express";
import type { DatabaseManager } from "../../../db/database.js";
import type { EventStreamManager } from "../../../events/eventStreamManager.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { SonosModuleManager } from "../../modules/sonos/sonosModuleManager.js";
import { logger } from "../../../../logger.js";

type Deps = {
  databaseManager: DatabaseManager;
  eventStreamManager: EventStreamManager;
  actionManager: ActionManager;
};

export function createSonosModuleRouter(deps: Deps) {
  const router = Router();
  const sonosModule = new SonosModuleManager(deps.databaseManager, deps.actionManager, deps.eventStreamManager);
  deps.actionManager.registerModuleManager(sonosModule);

  router.get("/devices/discover", async (_req, res) => {
    try {
      const devices = await sonosModule.discoverDevices();
      res.status(200).json(devices);
    } catch (error) {
      logger.error({ error }, "Fehler beim Discover von Sonos-Geräten");
      res.status(500).json({ error: "Fehler beim Discover von Sonos-Geräten" });
    }
  });

  router.post("/devices/:deviceId/setVolume", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const rawVolume = (req.body ?? {}).volume;
      let volume: number | null = null;
      if (typeof rawVolume === "number") {
        volume = rawVolume;
      } else if (typeof rawVolume === "string" && rawVolume.trim().length > 0) {
        const parsed = Number(rawVolume);
        if (!Number.isNaN(parsed)) volume = parsed;
      }
      if (volume == null) {
        res.status(400).json({ error: "Volume-Parameter fehlt" });
        return;
      }
      const success = await sonosModule.setVolume(deviceId, volume);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Lautstärke");
      res.status(500).json({ error: "Fehler beim Setzen der Lautstärke" });
    }
  });

  router.post("/devices/:deviceId/setOn", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const result = await sonosModule.setPlayState(deviceId, "play");
      if (result.success) {
        res.status(200).json({ success: true });
      } else {
        res.status(500).json({ error: result.error || "Fehler beim Einschalten des Geräts" });
      }
    } catch (error) {
      logger.error({ error }, "Fehler beim Einschalten des Geräts");
      res.status(500).json({ error: "Fehler beim Einschalten des Geräts" });
    }
  });

  router.post("/devices/:deviceId/setOff", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const result = await sonosModule.setPlayState(deviceId, "stop");
      if (result.success) {
        res.status(200).json({ success: true });
      } else {
        res.status(500).json({ error: result.error || "Fehler beim Ausschalten des Geräts" });
      }
    } catch (error) {
      logger.error({ error }, "Fehler beim Ausschalten des Geräts");
      res.status(500).json({ error: "Fehler beim Ausschalten des Geräts" });
    }
  });

  router.post("/devices/:deviceId/setPlayState", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const state = String((req.body ?? {}).state ?? "");
      if (!["play", "pause", "stop"].includes(state)) {
        res.status(400).json({ error: "Ungültiger State-Wert (muss 'play', 'pause' oder 'stop' sein)" });
        return;
      }
      const result = await sonosModule.setPlayState(deviceId, state);
      if (result.success) {
        res.status(200).json({ success: true });
      } else {
        res.status(500).json({ error: result.error || "Fehler beim Setzen des Wiedergabestatus" });
      }
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen des Wiedergabestatus");
      res.status(500).json({ error: "Fehler beim Setzen des Wiedergabestatus" });
    }
  });

  router.post("/devices/:deviceId/setMute", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const rawMute = (req.body ?? {}).mute;
      let mute: boolean | null = null;
      if (typeof rawMute === "boolean") {
        mute = rawMute;
      } else if (typeof rawMute === "string") {
        if (rawMute === "true" || rawMute === "false") {
          mute = rawMute === "true";
        }
      }
      if (mute == null) {
        res.status(400).json({ error: "Mute-Parameter fehlt" });
        return;
      }
      const success = await sonosModule.setMute(deviceId, mute);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Stummschaltung");
      res.status(500).json({ error: "Fehler beim Setzen der Stummschaltung" });
    }
  });

  router.post("/devices/:deviceId/playNext", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const success = await sonosModule.playNext(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Abspielen des naechsten Titels");
      res.status(500).json({ error: "Fehler beim Abspielen des naechsten Titels" });
    }
  });

  router.post("/devices/:deviceId/playPrevious", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const success = await sonosModule.playPrevious(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Abspielen des vorherigen Titels");
      res.status(500).json({ error: "Fehler beim Abspielen des vorherigen Titels" });
    }
  });

  return router;
}

