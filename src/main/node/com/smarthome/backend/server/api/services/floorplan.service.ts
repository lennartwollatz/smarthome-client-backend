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
