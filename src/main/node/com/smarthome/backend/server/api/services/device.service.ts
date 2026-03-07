import { Router } from "express";
import type { RouterDeps } from "../router.js";


export function createDeviceRouter(deps: RouterDeps) {
  const router = Router();

  router.get("/", (_req, res) => {
    const devices = deps.actionManager.getDevices();
    res.status(200).json(devices);
  });

  router.put("/:deviceId", (req, res) => {
    const deviceId = req.params.deviceId;
    const existing = deps.actionManager.getDevice(deviceId);

    if (!existing) {
      res.status(404).json({ error: "Device not found" });
      return;
    }

    const patch = req.body as Record<string, unknown>;
    const next = existing as any;

    if ("name" in patch && typeof patch.name === "string") next.name = patch.name;
    if ("room" in patch && (typeof patch.room === "string" || patch.room === undefined || patch.room === null)) next.room = patch.room ?? undefined;
    if ("icon" in patch && (typeof patch.icon === "string" || patch.icon === undefined)) next.icon = patch.icon;
    if ("typeLabel" in patch && (typeof patch.typeLabel === "string" || patch.typeLabel === undefined)) next.typeLabel = patch.typeLabel;
    if ("quickAccess" in patch && typeof patch.quickAccess === "boolean") next.quickAccess = patch.quickAccess;
    if ("temperatureGoal" in patch && typeof patch.temperatureGoal === "number" && Number.isFinite(patch.temperatureGoal)) {
      next.temperatureGoal = Math.max(5, Math.min(35, patch.temperatureGoal));
    }
    if ("buttons" in patch && typeof patch.buttons === "object" && patch.buttons !== null) {
      const incomingButtons = patch.buttons as Record<string, unknown>;
      const existingButtons = next.buttons as Record<string, Record<string, unknown>> | undefined;

      if (existingButtons && typeof existingButtons === "object") {
        for (const [buttonId, rawButtonPatch] of Object.entries(incomingButtons)) {
          const existingButton = existingButtons[buttonId];
          if (!existingButton || typeof existingButton !== "object") continue;
          if (!rawButtonPatch || typeof rawButtonPatch !== "object") continue;

          const buttonPatch = rawButtonPatch as Record<string, unknown>;
          if ("name" in buttonPatch && typeof buttonPatch.name === "string") {
            existingButton.name = buttonPatch.name;
          }
          if ("connectedToLight" in buttonPatch && typeof buttonPatch.connectedToLight === "boolean") {
            existingButton.connectedToLight = buttonPatch.connectedToLight;
          }
        }
      }
    }

    deps.actionManager.saveDevice(next as any);
    res.status(200).json(next);
  });

  return router;
}

