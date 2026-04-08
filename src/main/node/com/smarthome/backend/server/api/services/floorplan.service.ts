import { Router } from "express";
import type { Room } from "../entities/floorplan/Room.js";
import type { ServerDeps } from "../server.js";

export function createFloorPlanRouter(deps: ServerDeps) {
  const router = Router();
  const floorplanManager = deps.floorplanManager;

  router.get("/rooms", (_req, res) => {
    res.status(200).json(floorplanManager.findAllRooms());
  });

  router.post("/rooms", (req, res) => {
    res.status(200).json(floorplanManager.addRoom(req.body as Room));
  });

  router.put("/rooms/reorder", (req, res) => {
    const body = req.body as { roomIds?: unknown };
    if (!Array.isArray(body.roomIds) || !body.roomIds.every((id): id is string => typeof id === "string")) {
      res.status(400).json({ error: "Body must be { roomIds: string[] }" });
      return;
    }
    try {
      const rooms = floorplanManager.reorderRooms(body.roomIds);
      res.status(200).json(rooms);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: message });
    }
  });

  router.put("/rooms/:roomId", (req, res) => {
    res.status(200).json(floorplanManager.updateRoom(req.params.roomId, req.body as Room));
  });

  router.delete("/rooms/:roomId", (req, res) => {
    const deleted = floorplanManager.deleteRoom(req.params.roomId);
    if (deleted) {
      res.status(200).json({ success: true });
    } else {
      res.status(404).json({ error: "Room not found" });
    }
  });

  return router;
}
