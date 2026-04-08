import { Router } from "express";
import { logger } from "../../../logger.js";
import type { ServerDeps } from "../server.js";

export function createDeviceRouter(deps: ServerDeps) {
  const router = Router();

  router.get("/", (_req, res) => {
    const devices = deps.deviceManager.getDevices();
    res.status(200).json(devices);
  });

  router.delete("/:deviceId", async (req, res) => {
    const deviceId = req.params.deviceId;
    const existing = deps.deviceManager.getDevice(deviceId);
    if (!existing) {
      res.status(404).json({ success: false, error: "Device not found" });
      return;
    }
    const moduleId = existing.moduleId ?? "";
    const moduleMgr = moduleId ? deps.deviceManager.getModuleManager(moduleId) : undefined;
    try {
      if (moduleMgr) {
        await moduleMgr.prepareRemoveDevice(deviceId);
      }
    } catch (err) {
      logger.error({ err, deviceId }, "prepareRemoveDevice");
      res.status(500).json({ success: false, error: "Device remove preparation failed" });
      return;
    }
    const success = deps.deviceManager.removeDevice(deviceId);
    res.status(success ? 200 : 404).json(success ? { success: true } : { success: false, error: "Device not found" });
  });

  router.put("/:deviceId", async (req, res) => {
    const patch = req.body as Record<string, unknown>;
    try {
      const device = await deps.deviceManager.updateDeviceSettings(req.params.deviceId, patch);
      if (!device) {
        res.status(404).json({ success: false, error: "Device not found" });
      } else {
        res.status(200).json({ success: true, device });
      }
    } catch (error) {
      logger.error({ error, deviceId: req.params.deviceId }, "updateDeviceSettings");
      res.status(500).json({ success: false, error: "Device update failed" });
    }
  });

  router.post("/group-speakers", async (req, res) => {
    const body = req.body as { speakerIds?: unknown };
    const speakerIds = body?.speakerIds;
    if (!Array.isArray(speakerIds) || !speakerIds.every(id => typeof id === "string" && id.trim() !== "")) {
      res.status(400).json({ success: false, error: "Ungültiger Body: speakerIds (string[]) erforderlich" });
      return;
    }
    try {
      const devices = await deps.deviceManager.groupSpeakersByIds(speakerIds);
      res.status(200).json({
        success: true,
        devices: devices.map(d => (typeof (d as { toJSON?: () => Record<string, unknown> }).toJSON === "function" ? (d as { toJSON: () => Record<string, unknown> }).toJSON() : d))
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gruppierung fehlgeschlagen";
      logger.error({ error, speakerIds }, "groupSpeakers");
      res.status(400).json({ success: false, error: message });
    }
  });

  router.post("/ungroup-speaker", async (req, res) => {
    const body = req.body as { deviceId?: unknown };
    const deviceId = body?.deviceId;
    if (typeof deviceId !== "string" || deviceId.trim() === "") {
      res.status(400).json({ success: false, error: "Ungültiger Body: deviceId (string) erforderlich" });
      return;
    }
    try {
      const devices = await deps.deviceManager.ungroupSpeakerById(deviceId.trim());
      res.status(200).json({
        success: true,
        devices: devices.map(d =>
          typeof (d as { toJSON?: () => Record<string, unknown> }).toJSON === "function"
            ? (d as { toJSON: () => Record<string, unknown> }).toJSON()
            : d
        )
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gruppe konnte nicht aufgelöst werden";
      logger.error({ error, deviceId }, "ungroupSpeaker");
      res.status(400).json({ success: false, error: message });
    }
  });

  return router;
}
