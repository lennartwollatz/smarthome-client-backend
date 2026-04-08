import { Router } from "express";
import { DenonModuleManager } from "../../modules/heos/denon/denonModuleManager.js";
import { logger } from "../../../../logger.js";
import type { ServerDeps } from "../../server.js";

export function createDenonModuleRouter(deps: ServerDeps) {
  const router = Router();
  const denonModule = new DenonModuleManager(deps.databaseManager, deps.deviceManager, deps.eventManager);
  deps.deviceManager.registerModuleManager(denonModule);

  router.get("/devices/discover", async (_req, res) => {
    try {
      const devices = await denonModule.discoverDevices();
      res.status(200).json(devices);
    } catch (error) {
      logger.error({ error }, "Fehler beim Discover von Denon-Geräten");
      res.status(500).json({ error: "Fehler beim Discover von Denon-Geräten" });
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
      const success = await denonModule.setVolume(deviceId, volume);
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
      const success = await denonModule.setPlayState(deviceId, "play");
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
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
      const success = await denonModule.setPlayState(deviceId, "stop");
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
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
      const success = await denonModule.setPlayState(deviceId, state);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
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
      const success = await denonModule.setMute(deviceId, mute);
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
      const success = await denonModule.playNext(deviceId);
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
      const success = await denonModule.playPrevious(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Abspielen des vorherigen Titels");
      res.status(500).json({ error: "Fehler beim Abspielen des vorherigen Titels" });
    }
  });

  router.post("/devices/:deviceId/setVolumeStart", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const raw = (req.body ?? {}).volumeStart;
      const volumeStart = typeof raw === "number" ? raw : (typeof raw === "string" ? Number(raw) : NaN);
      if (Number.isNaN(volumeStart) || volumeStart < 0 || volumeStart > 50) {
        res.status(400).json({ error: "Parameter volumeStart fehlt oder ungültig (0–50)" });
        return;
      }
      const success = await denonModule.setVolumeStart(deviceId, volumeStart);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen von Volume-Start");
      res.status(500).json({ error: "Fehler beim Setzen von Volume-Start" });
    }
  });

  router.post("/devices/:deviceId/setVolumeMax", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const raw = (req.body ?? {}).volumeMax;
      const volumeMax = typeof raw === "number" ? raw : (typeof raw === "string" ? Number(raw) : NaN);
      if (Number.isNaN(volumeMax) || volumeMax < 40 || volumeMax > 98) {
        res.status(400).json({ error: "Parameter volumeMax fehlt oder ungültig (40–98)" });
        return;
      }
      const success = await denonModule.setVolumeMax(deviceId, volumeMax);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen von Volume-Max");
      res.status(500).json({ error: "Fehler beim Setzen von Volume-Max" });
    }
  });

  router.post("/devices/:deviceId/setSource", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const sourceIndex = String((req.body ?? {}).sourceIndex ?? "").trim();
      const rawSelected = (req.body ?? {}).selected;
      const selected = rawSelected === true || rawSelected === "true";
      if (!sourceIndex) {
        res.status(400).json({ error: "Parameter sourceIndex fehlt" });
        return;
      }
      const success = await denonModule.setSource(deviceId, sourceIndex, selected);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der aktiven Quelle");
      res.status(500).json({ error: "Fehler beim Setzen der aktiven Quelle" });
    }
  });

  router.post("/devices/:deviceId/setZonePower", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const zoneName = String((req.body ?? {}).zoneName ?? "").trim();
      const rawPower = (req.body ?? {}).power;
      const power = rawPower === true || rawPower === "true";
      if (!zoneName) {
        res.status(400).json({ error: "Parameter zoneName fehlt" });
        return;
      }
      const success = await denonModule.setZonePower(deviceId, zoneName, power);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Zonen-Power");
      res.status(500).json({ error: "Fehler beim Setzen der Zonen-Power" });
    }
  });

  router.post("/devices/:deviceId/setSubwooferPower", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const subwooferId = String((req.body ?? {}).subwooferId ?? "").trim();
      const rawPower = (req.body ?? {}).power;
      let power: boolean | null = null;
      if (typeof rawPower === "boolean") {
        power = rawPower;
      } else if (typeof rawPower === "string") {
        if (rawPower === "true" || rawPower === "false") {
          power = rawPower === "true";
        }
      }
      if (!subwooferId || power == null) {
        res.status(400).json({ error: "Parameter subwooferId oder power fehlt bzw. ungültig" });
        return;
      }
      const success = await denonModule.setSubwooferPower(deviceId, subwooferId, power);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Subwoofer-Power");
      res.status(500).json({ error: "Fehler beim Setzen der Subwoofer-Power" });
    }
  });

  router.post("/devices/:deviceId/setSubwooferLevel", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        res.status(400).json({ error: "Ungültige Device ID" });
        return;
      }
      const subwooferId = String((req.body ?? {}).subwooferId ?? "").trim();
      const rawLevel = (req.body ?? {}).level;
      const level = typeof rawLevel === "number" ? rawLevel : (typeof rawLevel === "string" ? Number(rawLevel) : NaN);
      if (!subwooferId || Number.isNaN(level)) {
        res.status(400).json({ error: "Parameter subwooferId oder level fehlt bzw. ungültig" });
        return;
      }
      const success = await denonModule.setSubwooferLevel(deviceId, subwooferId, level);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Gerät nicht gefunden" });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen des Subwoofer-Pegels");
      res.status(500).json({ error: "Fehler beim Setzen des Subwoofer-Pegels" });
    }
  });

  return router;
}

