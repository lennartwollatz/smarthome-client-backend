import { Router } from "express";
import type { ServerDeps } from "../server.js";

export function createDeviceRouter(deps: ServerDeps) {
  const router = Router();

  router.get("/", (_req, res) => {
    const devices = deps.deviceManager.getDevices();
    res.status(200).json(devices);
  });

  router.delete("/:deviceId", (req, res) => {
    const deviceId = req.params.deviceId;
    const success = deps.deviceManager.removeDevice(deviceId);
    res.status(success ? 200 : 404).json(success ? { success: true } : { success: false, error: "Device not found" });
  });

  router.put("/:deviceId", (req, res) => {
    const patch = req.body as Record<string, unknown>;
    const device = deps.deviceManager.updateDeviceSettings(req.params.deviceId, patch);
    if (!device) {
      res.status(404).json({success: false, error: "Device not found" });
    } else {
      res.status(200).json({success: true, device});
    }
  });

  return router;
}
