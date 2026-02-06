import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { DatabaseManager } from "../../db/database.js";
import type { ActionManager } from "../../actions/actionManager.js";
import { JsonRepository } from "../../db/jsonRepository.js";
import type { FloorPlan, Room } from "../../../model/index.js";

type Deps = {
  databaseManager: DatabaseManager;
  actionManager: ActionManager;
};

export function createFloorPlanRouter(deps: Deps) {
  const router = Router();
  const floorPlanRepository = new JsonRepository<FloorPlan>(deps.databaseManager, "FloorPlan");
  const roomRepository = new JsonRepository<Room>(deps.databaseManager, "Room");

  router.get("/", (_req, res) => {
    const floorPlan = floorPlanRepository.findById("main-floorplan");
    if (floorPlan) {
      res.status(200).json(floorPlan);
    } else {
      const empty: FloorPlan = { rooms: [] };
      floorPlanRepository.save("main-floorplan", empty);
      res.status(200).json(empty);
    }
  });

  router.put("/", (req, res) => {
    const floorPlan = req.body as FloorPlan;
    floorPlanRepository.save("main-floorplan", floorPlan);
    res.status(200).json(floorPlan);
  });

  router.post("/rooms", (req, res) => {
    const room = req.body as Room;
    if (!room.id) room.id = `room-${randomUUID()}`;

    // Wenn kein Index gesetzt ist, den höchsten Index + 1 vergeben
    if (room.index === undefined || room.index === null) {
      const floorPlan = floorPlanRepository.findById("main-floorplan") ?? { rooms: [] };
      if (!Array.isArray(floorPlan.rooms)) floorPlan.rooms = [];
      const maxIndex = floorPlan.rooms.reduce((max, r) => {
        const idx = r.index ?? -1;
        return idx > max ? idx : max;
      }, -1);
      room.index = maxIndex + 1;
    }

    roomRepository.save(room.id, room);

    const floorPlan = floorPlanRepository.findById("main-floorplan") ?? { rooms: [] };
    if (!Array.isArray(floorPlan.rooms)) floorPlan.rooms = [];
    floorPlan.rooms = floorPlan.rooms.filter(existing => existing.id !== room.id);
    floorPlan.rooms.push(room);
    floorPlanRepository.save("main-floorplan", floorPlan);

    res.status(200).json(room);
  });

  router.put("/rooms/:roomId", (req, res) => {
    const room = req.body as Room;
    room.id = req.params.roomId;
    roomRepository.save(room.id, room);

    const floorPlan = floorPlanRepository.findById("main-floorplan");
    if (floorPlan && Array.isArray(floorPlan.rooms)) {
      floorPlan.rooms = floorPlan.rooms.filter(existing => existing.id !== room.id);
      floorPlan.rooms.push(room);
      floorPlanRepository.save("main-floorplan", floorPlan);
    }

    res.status(200).json(room);
  });

  router.delete("/rooms/:roomId", (req, res) => {
    const deleted = roomRepository.deleteById(req.params.roomId);
    if (deleted) {
      const floorPlan = floorPlanRepository.findById("main-floorplan");
      if (floorPlan && Array.isArray(floorPlan.rooms)) {
        floorPlan.rooms = floorPlan.rooms.filter(existing => existing.id !== req.params.roomId);
        floorPlanRepository.save("main-floorplan", floorPlan);
      }
      deps.actionManager.removeRoomFromDevices(req.params.roomId);
      res.status(204).json("");
    } else {
      res.status(404).json({ error: "Room not found" });
    }
  });

  return router;
}

