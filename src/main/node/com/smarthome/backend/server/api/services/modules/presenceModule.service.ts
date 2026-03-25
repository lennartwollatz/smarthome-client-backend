import { Router } from "express";
import { logger } from "../../../../logger.js";
import type { RouterDeps } from "../../router.js";

export function createPresenceModuleRouter(deps: RouterDeps) {
  const router = Router();
  const { presenceManager } = deps;

  const extractUserId = (deviceId: string): string | null => {
    if (!deviceId.startsWith("presence-")) return null;
    return deviceId.slice("presence-".length);
  };

  router.post("/devices/:deviceId/:buttonId/setOn", async (req, res) => {
    try {
      const { deviceId, buttonId } = req.params;
      const userId = extractUserId(deviceId);
      if (!userId) {
        res.status(404).json({ success: false, error: "Device not found" });
        return;
      }
      const result = presenceManager.setPresenceButtonState(userId, buttonId, true);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen des Presence-Buttons");
      res.status(400).json({ success: false });
    }
  });

  router.post("/devices/:deviceId/:buttonId/setOff", async (req, res) => {
    try {
      const { deviceId, buttonId } = req.params;
      const userId = extractUserId(deviceId);
      if (!userId) {
        res.status(404).json({ success: false, error: "Device not found" });
        return;
      }
      const result = presenceManager.setPresenceButtonState(userId, buttonId, false);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen des Presence-Buttons");
      res.status(400).json({ success: false });
    }
  });

  router.post("/devices/:deviceId/:buttonId/toggle", async (req, res) => {
    try {
      const { deviceId, buttonId } = req.params;
      const userId = extractUserId(deviceId);
      if (!userId) {
        res.status(404).json({ success: false, error: "Device not found" });
        return;
      }
      const result = presenceManager.togglePresenceButton(userId, buttonId);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Toggle des Presence-Buttons");
      res.status(400).json({ success: false });
    }
  });

  return router;
}
