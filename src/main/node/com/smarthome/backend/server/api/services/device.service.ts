import { Router } from "express";
import type { DatabaseManager } from "../../db/database.js";
import type { EventStreamManager } from "../../events/eventStreamManager.js";
import type { ActionManager } from "../../actions/actionManager.js";
import { JsonRepository } from "../../db/jsonRepository.js";

type Device = Record<string, unknown>;

type Deps = {
  databaseManager: DatabaseManager;
  eventStreamManager: EventStreamManager;
  actionManager: ActionManager;
};

export function createDeviceRouter(deps: Deps) {
  const router = Router();
  const repo = new JsonRepository<Device>(deps.databaseManager, "Device");

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
    const next = { ...existing };

    if ("name" in patch && typeof patch.name === "string") next.name = patch.name;
    if ("room" in patch && (typeof patch.room === "string" || patch.room === undefined || patch.room === null)) next.room = patch.room ?? undefined;
    if ("icon" in patch && (typeof patch.icon === "string" || patch.icon === undefined)) next.icon = patch.icon;
    if ("typeLabel" in patch && (typeof patch.typeLabel === "string" || patch.typeLabel === undefined)) next.typeLabel = patch.typeLabel;
    if ("moduleId" in patch && (typeof patch.moduleId === "string" || patch.moduleId === undefined)) next.moduleId = patch.moduleId;
    if ("isConnected" in patch && typeof patch.isConnected === "boolean") next.isConnected = patch.isConnected;
    if ("isConnecting" in patch && typeof patch.isConnecting === "boolean") next.isConnecting = patch.isConnecting;
    if ("quickAccess" in patch && typeof patch.quickAccess === "boolean") next.quickAccess = patch.quickAccess;

    repo.save(deviceId, next);
    // Aktualisiere auch den ActionManager
    deps.actionManager.saveDevice(next as any);
    res.status(200).json(next);
  });

  return router;
}

