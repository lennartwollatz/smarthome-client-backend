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

  router.post("/devices/:deviceId/setPresent", async (req, res) => {
    try {
      const userId = extractUserId(req.params.deviceId);
      if (!userId) {
        res.status(404).json({ success: false, error: "Device not found" });
        return;
      }
      const result = presenceManager.setPresenceState(userId, true);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen des Presence-Status");
      res.status(400).json({ success: false });
    }
  });

  router.post("/devices/:deviceId/setAbsent", async (req, res) => {
    try {
      const userId = extractUserId(req.params.deviceId);
      if (!userId) {
        res.status(404).json({ success: false, error: "Device not found" });
        return;
      }
      const result = presenceManager.setPresenceState(userId, false);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen des Presence-Status");
      res.status(400).json({ success: false });
    }
  });

  router.post("/devices/:deviceId/togglePresence", async (req, res) => {
    try {
      const userId = extractUserId(req.params.deviceId);
      if (!userId) {
        res.status(404).json({ success: false, error: "Device not found" });
        return;
      }
      const result = presenceManager.togglePresence(userId);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Toggle des Presence-Status");
      res.status(400).json({ success: false });
    }
  });

  return router;
}
