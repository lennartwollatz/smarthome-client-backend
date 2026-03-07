import { Router } from "express";
import { MatterModuleManager } from "../../modules/matter/matterModuleManager.js";
import { logger } from "../../../../logger.js";
import type { RouterDeps } from "../../router.js";

export function createMatterModuleRouter(deps: RouterDeps) {
  const router = Router();
  const matterModule = new MatterModuleManager(deps.databaseManager, deps.actionManager, deps.eventManager);
  deps.actionManager.registerModuleManager(matterModule);

  router.get("/devices/discover", async (_req, res) => {
    try {
      const devices = await matterModule.discoverDevices();
      res.status(200).json(devices);
    } catch (error) {
      logger.error({ error }, "Fehler beim Discover von Matter-Geraeten");
      res.status(500).json({ error: "Fehler beim Discover von Matter-Geraeten" });
    }
  });

  router.post("/devices/:deviceId/pair", async (req, res) => {
    try {
      const result = await matterModule.pairDevice(req.params.deviceId, req.body ?? {});
      res.status(result.success ? 200 : 404).json(
        result.success
          ? { success: true, nodeId: result.nodeId, deviceId: result.deviceId }
          : { success: false, error: result.error ?? "Gerät nicht gefunden oder Pairing fehlgeschlagen" }
      );
    } catch (error) {
      logger.error({ error }, "Fehler beim Pairing des Matter-Geraets");
      res.status(400).json({ error: "Invalid request" });
    }
  });

   // Pairing nur über Code (ohne deviceId)
   router.post("/devices/pair-by-code", async (req, res) => {
    try {
      const result = await matterModule.pairDeviceByCode(req.body ?? {});
      res.status(result.success ? 200 : 404).json(
        result.success
          ? { success: true, nodeId: result.nodeId, deviceId: result.deviceId }
          : { success: false, error: result.error ?? "Gerät nicht gefunden oder Pairing fehlgeschlagen" }
      );
    } catch (error) {
      logger.error({ error }, "Fehler beim Pairing by Code des Matter-Geraets");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Toggle eines konkreten Buttons eines Matter-Switches
  router.post("/devices/:deviceId/:buttonId/toggle", async (req, res) => {
    try {
      const result = await matterModule.toggle(req.params.deviceId, req.params.buttonId);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Toggle eines Matter-Buttons");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Setzen des On-Zustands eines konkreten Buttons eines Matter-Switches
  router.post("/devices/:deviceId/:buttonId/setOn", async (req, res) => {
    try {
      const result = await matterModule.setOn(req.params.deviceId, req.params.buttonId);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen des On-Zustands eines Matter-Buttons");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Setzen des Off-Zustands eines konkreten Buttons eines Matter-Switches
  router.post("/devices/:deviceId/:buttonId/setOff", async (req, res) => {
    try {
      const result = await matterModule.setOff(req.params.deviceId, req.params.buttonId);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen des Off-Zustands eines Matter-Buttons");
      res.status(400).json({ error: "Invalid request" });
    }
  });

   // Setzen der Intensität eines konkreten Buttons eines Matter-Switches
   router.post("/devices/:deviceId/:buttonId/setIntensity", async (req, res) => {
    try {
      const result = await matterModule.setIntensity(req.params.deviceId, req.params.buttonId, req.body.intensity ?? 0);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Intensität eines Matter-Buttons");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Setzen der Intensität eines konkreten Buttons eines Matter-Switches
  router.post("/devices/:deviceId/setTemperature", async (req, res) => {
    try {
      const temperature = req.body?.temperature ?? req.body?.temperatureGoal;
      const result = await matterModule.setTemperatureGoal(req.params.deviceId, temperature);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Temperatur eines Matter-Thermostats");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Setzen der Intensität eines konkreten Buttons eines Matter-Switches
  router.post("/devices/:deviceId/setTemperatureSchedules", async (req, res) => {
    try {
      const result = await matterModule.setTemperatureSchedules(req.params.deviceId, req.body.temperatureSchedules ?? []);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Temperatur-Schedules eines Matter-Thermostats");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  return router;
}

