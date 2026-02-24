import { Router } from "express";
import type { DatabaseManager } from "../../../db/database.js";
import type { EventStreamManager } from "../../../events/eventStreamManager.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { MatterModuleManager } from "../../modules/matter/matterModuleManager.js";
import { logger } from "../../../../logger.js";

type Deps = {
  databaseManager: DatabaseManager;
  eventStreamManager: EventStreamManager;
  actionManager: ActionManager;
};

export function createMatterModuleRouter(deps: Deps) {
  const router = Router();
  const matterModule = new MatterModuleManager(deps.databaseManager, deps.actionManager, deps.eventStreamManager);
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
      const code = String((req.body ?? {})?.pairingCode ?? (req.body ?? {})?.code ?? "").trim();
      const result = await matterModule.pairDeviceByCode(code);
      res.status(result.success ? 200 : 400).json(result.success ? result : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Pairing by Code des Matter-Geraets");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  return router;
}

