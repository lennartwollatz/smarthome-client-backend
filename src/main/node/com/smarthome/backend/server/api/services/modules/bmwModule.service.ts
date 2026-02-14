import { Router } from "express";
import type { DatabaseManager } from "../../../db/database.js";
import type { EventStreamManager } from "../../../events/eventStreamManager.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { logger } from "../../../../logger.js";
import { BMWModuleManager } from "../../modules/bmw/bmwModuleManager.js";

type Deps = {
  databaseManager: DatabaseManager;
  eventStreamManager: EventStreamManager;
  actionManager: ActionManager;
};

export function createBMWModuleRouter(deps: Deps) {
  const router = Router();
  const bmwModule = new BMWModuleManager(deps.databaseManager, deps.actionManager, deps.eventStreamManager);
  deps.actionManager.registerModuleManager(bmwModule);

  router.get("/credentials", (_req, res) => {
    const info = bmwModule.getCredentialsInfo();
    // Passwort ist absichtlich write-only und wird nie zurueckgegeben.
    res.status(200).json(info);
  });

  router.put("/credentials", (req, res) => {
    const usernameRaw = (req.body ?? {}).username;
    const passwordRaw = (req.body ?? {}).password;
    const captchaTokenRaw = (req.body ?? {}).captchaToken;
    const username = typeof usernameRaw === "string" ? usernameRaw.trim() : "";
    const password = typeof passwordRaw === "string" ? passwordRaw : undefined;
    const captchaToken = typeof captchaTokenRaw === "string" ? captchaTokenRaw : undefined;
    if (!username) {
      res.status(400).json({ error: "username ist erforderlich" });
      return;
    }
    bmwModule.setCredentials(username, password, captchaToken);
    res.status(200).json(bmwModule.getCredentialsInfo());
  });

  router.put("/credentials/password", (req, res) => {
    const passwordRaw = (req.body ?? {}).password;
    const password = typeof passwordRaw === "string" ? passwordRaw : "";
    if (!password) {
      res.status(400).json({ error: "password ist erforderlich" });
      return;
    }
    bmwModule.setPassword(password);
    res.status(200).json(bmwModule.getCredentialsInfo());
  });

  router.put("/credentials/captchaToken", (req, res) => {
    const tokenRaw = (req.body ?? {}).captchaToken;
    const captchaToken = typeof tokenRaw === "string" ? tokenRaw : "";
    if (!captchaToken) {
      res.status(400).json({ error: "captchaToken ist erforderlich" });
      return;
    }
    bmwModule.setCaptchaToken(captchaToken);
    res.status(200).json(bmwModule.getCredentialsInfo());
  });

  router.get("/devices/discover", async (_req, res) => {
    try {
      const creds = bmwModule.getCredentialsInfo();
      if (!creds.canDiscover) {
        res.status(400).json({
          error: creds.hasBmwToken
            ? "Discovery ist erst nach Setzen von Username und Passwort moeglich"
            : "Discovery ist erst nach Setzen von Username und Passwort moeglich (Captcha nur beim ersten Login noetig)",
          credentials: creds
        });
        return;
      }
      const devices = await bmwModule.discoverDevices();
      res.status(200).json(devices);
    } catch (error) {
      logger.error({ error }, "Fehler beim Discover von BMW Fahrzeugen");
      res.status(500).json({ error: "Fehler beim Discover von BMW Fahrzeugen" });
    }
  });

  router.post("/devices/:deviceId/climate/start", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    const success = await bmwModule.startClimateControl(deviceId);
    res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Fahrzeug nicht gefunden" });
  });

  router.post("/devices/:deviceId/climate/stop", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    const success = await bmwModule.stopClimateControl(deviceId);
    res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Fahrzeug nicht gefunden" });
  });

  router.post("/devices/:deviceId/sendAddress", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }

    const subjectRaw = (req.body ?? {}).subject;
    const nameRaw = (req.body ?? {}).name;
    const latitudeRaw = (req.body ?? {}).latitude;
    const longitudeRaw = (req.body ?? {}).longitude;

    const subject = typeof subjectRaw === "string" && subjectRaw.trim() ? subjectRaw.trim() : "Ziel";
    const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : "";
    const latitude = typeof latitudeRaw === "number" ? latitudeRaw : Number(latitudeRaw);
    const longitude = typeof longitudeRaw === "number" ? longitudeRaw : Number(longitudeRaw);

    if (!name || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      res.status(400).json({ error: "name, latitude und longitude sind erforderlich" });
      return;
    }

    const success = await bmwModule.sendAddress(deviceId, subject, {
      name,
      coordinates: { latitude, longitude }
    });
    res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Fahrzeug nicht gefunden" });
  });

  router.post("/devices/:deviceId/refresh", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    const success = await bmwModule.refreshDevice(deviceId);
    res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Fahrzeug nicht gefunden" });
  });

  return router;
}

