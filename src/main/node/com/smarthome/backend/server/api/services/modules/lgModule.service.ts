import { Router } from "express";
import type { DatabaseManager } from "../../../db/database.js";
import type { EventStreamManager } from "../../../events/eventStreamManager.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { LGModuleManager } from "../../modules/lg/lgModuleManager.js";
import { logger } from "../../../../logger.js";

type Deps = {
  databaseManager: DatabaseManager;
  eventStreamManager: EventStreamManager;
  actionManager: ActionManager;
};

export function createLGModuleRouter(deps: Deps) {
  const router = Router();
  const lgModule = new LGModuleManager(deps.databaseManager, deps.actionManager, deps.eventStreamManager);
  deps.actionManager.registerModuleManager(lgModule);

  router.get("/devices/discover", async (_req, res) => {
    try {
      const devices = await lgModule.discoverDevices();
      res.status(200).json(devices);
    } catch (error) {
      logger.error({ error }, "Fehler beim Discover von LG-Geraeten");
      res.status(500).json({ error: "Fehler beim Discover von LG-Geraeten" });
    }
  });

  router.post("/devices/:deviceId/pair", async (req, res) => {
    try {
      const success = await lgModule.connectDevice(req.params.deviceId);
      res.status(success ? 200 : 404).json(
        success ? { success: true } : { error: "Gerät nicht gefunden oder nicht unterstützt" }
      );
    } catch (error) {
      logger.error({ error }, "Fehler beim Pairing des LG-Geraets");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/setOn", async (req, res) => {
    try {
      const success = await lgModule.powerOn(req.params.deviceId);
      res.status(success ? 200 : 404).json(
        success ? { success: true } : { error: "Gerät nicht gefunden oder nicht unterstützt" }
      );
    } catch (error) {
      logger.error({ error }, "Fehler beim Einschalten des LG-Geraets");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/setOff", async (req, res) => {
    try {
      const success = await lgModule.powerOff(req.params.deviceId);
      res.status(success ? 200 : 404).json(
        success ? { success: true } : { error: "Gerät nicht gefunden oder nicht unterstützt" }
      );
    } catch (error) {
      logger.error({ error }, "Fehler beim Ausschalten des LG-Geraets");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/setVolume", async (req, res) => {
    try {
      const rawVolume = (req.body ?? {}).volume;
      let volume: number | null = null;
      if (typeof rawVolume === "number") {
        volume = rawVolume;
      } else if (typeof rawVolume === "string" && rawVolume.trim().length > 0) {
        const parsed = Number(rawVolume);
        if (!Number.isNaN(parsed)) volume = parsed;
      }
      if (volume == null) {
        res.status(400).json({ error: "volume parameter is required" });
        return;
      }
      const success = await lgModule.setVolume(req.params.deviceId, volume);
      res.status(success ? 200 : 404).json(
        success ? { success: true } : { error: "Gerät nicht gefunden oder nicht unterstützt" }
      );
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Lautstaerke");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/screenOn", async (req, res) => {
    try {
      const success = await lgModule.screenOn(req.params.deviceId);
      res.status(success ? 200 : 404).json(
        success ? { success: true } : { error: "Gerät nicht gefunden oder nicht unterstützt" }
      );
    } catch (error) {
      logger.error({ error }, "Fehler beim Einschalten des LG-Screens");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/screenOff", async (req, res) => {
    try {
      const success = await lgModule.screenOff(req.params.deviceId);
      res.status(success ? 200 : 404).json(
        success ? { success: true } : { error: "Gerät nicht gefunden oder nicht unterstützt" }
      );
    } catch (error) {
      logger.error({ error }, "Fehler beim Ausschalten des LG-Screens");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/setChannel", async (req, res) => {
    try {
      const channelId = String((req.body ?? {}).channelId ?? "");
      if (!channelId) {
        res.status(400).json({ error: "channelId parameter is required" });
        return;
      }
      const success = await lgModule.setChannel(req.params.deviceId, channelId);
      res.status(success ? 200 : 404).json(
        success ? { success: true } : { error: "Gerät nicht gefunden oder nicht unterstützt" }
      );
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen des Channels");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/startApp", async (req, res) => {
    try {
      const appId = String((req.body ?? {}).appId ?? "");
      if (!appId) {
        res.status(400).json({ error: "appId parameter is required" });
        return;
      }
      const success = await lgModule.startApp(req.params.deviceId, appId);
      res.status(success ? 200 : 404).json(
        success ? { success: true } : { error: "Gerät nicht gefunden oder nicht unterstützt" }
      );
    } catch (error) {
      logger.error({ error }, "Fehler beim Starten der App");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/notify", async (req, res) => {
    try {
      const message = String((req.body ?? {}).message ?? "");
      if (!message) {
        res.status(400).json({ error: "message parameter is required" });
        return;
      }
      const success = await lgModule.notify(req.params.deviceId, message);
      res.status(success ? 200 : 404).json(
        success ? { success: true } : { error: "Gerät nicht gefunden oder nicht unterstützt" }
      );
    } catch (error) {
      logger.error({ error }, "Fehler beim Senden der Benachrichtigung");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.get("/devices/:deviceId/channels", async (req, res) => {
    try {
      const channels = await lgModule.getChannels(req.params.deviceId);
      if (!channels) {
        res.status(404).json({ error: "Gerät nicht gefunden oder keine Daten" });
        return;
      }
      res.status(200).json(channels);
    } catch (error) {
      logger.error({ error }, "Fehler beim Laden der Channels");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.get("/devices/:deviceId/apps", async (req, res) => {
    try {
      const apps = await lgModule.getApps(req.params.deviceId);
      if (!apps) {
        res.status(404).json({ error: "Gerät nicht gefunden oder keine Daten" });
        return;
      }
      res.status(200).json(apps);
    } catch (error) {
      logger.error({ error }, "Fehler beim Laden der Apps");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.get("/devices/:deviceId/selectedApp", async (req, res) => {
    try {
      const appId = await lgModule.getSelectedApp(req.params.deviceId);
      if (!appId) {
        res.status(404).json({ error: "Gerät nicht gefunden oder keine Daten" });
        return;
      }
      res.status(200).json({ appId });
    } catch (error) {
      logger.error({ error }, "Fehler beim Laden der ausgewaehlten App");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.get("/devices/:deviceId/selectedChannel", async (req, res) => {
    try {
      const channelId = await lgModule.getSelectedChannel(req.params.deviceId);
      if (!channelId) {
        res.status(404).json({ error: "Gerät nicht gefunden oder keine Daten" });
        return;
      }
      res.status(200).json({ channelId });
    } catch (error) {
      logger.error({ error }, "Fehler beim Laden des ausgewaehlten Channels");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/setHomeAppNumber", async (req, res) => {
    try {
      const appId = String((req.body ?? {}).appId ?? "");
      const rawNumber = (req.body ?? {}).homeAppNumber;
      let homeAppNumber: number | null = null;
      if (typeof rawNumber === "number") {
        homeAppNumber = rawNumber;
      } else if (typeof rawNumber === "string" && rawNumber.trim().length > 0) {
        const parsed = Number(rawNumber);
        if (!Number.isNaN(parsed)) homeAppNumber = parsed;
      }
      if (!appId || homeAppNumber == null) {
        res.status(400).json({ error: "appId und homeAppNumber sind erforderlich" });
        return;
      }
      const success = await lgModule.setHomeAppNumber(req.params.deviceId, appId, homeAppNumber);
      res.status(success ? 200 : 404).json(
        success ? { success: true } : { error: "Gerät/App nicht gefunden oder ungültige Nummer" }
      );
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Home-App-Nummer");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/setHomeChannelNumber", async (req, res) => {
    try {
      const channelId = String((req.body ?? {}).channelId ?? "");
      const rawNumber = (req.body ?? {}).homeChannelNumber;
      let homeChannelNumber: number | null = null;
      if (typeof rawNumber === "number") {
        homeChannelNumber = rawNumber;
      } else if (typeof rawNumber === "string" && rawNumber.trim().length > 0) {
        const parsed = Number(rawNumber);
        if (!Number.isNaN(parsed)) homeChannelNumber = parsed;
      }
      if (!channelId || homeChannelNumber == null) {
        res.status(400).json({ error: "channelId und homeChannelNumber sind erforderlich" });
        return;
      }
      const success = await lgModule.setHomeChannelNumber(req.params.deviceId, channelId, homeChannelNumber);
      res.status(success ? 200 : 404).json(
        success ? { success: true } : { error: "Gerät/Channel nicht gefunden oder ungültige Nummer" }
      );
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Home-Channel-Nummer");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  return router;
}

