import { randomUUID } from "node:crypto";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import type { FloorPlan } from "./FloorPlan.js";
import type { Room } from "./Room.js";
import { DeviceManager } from "../devices/deviceManager.js";
import { EntityManager } from "../EntityManager.js";
import { LiveUpdateService } from "../../services/live.service.js";

const MAIN_FLOORPLAN_ID = "main-floorplan";

export class FloorplanManager implements EntityManager {
  private floorPlanRepository: JsonRepository<FloorPlan>;
  private roomRepository: JsonRepository<Room>;
  private liveUpdateService?: LiveUpdateService;

  constructor(
    databaseManager: DatabaseManager,
    private deviceManager: DeviceManager
  ) {
    this.floorPlanRepository = new JsonRepository<FloorPlan>(databaseManager, "FloorPlan");
    this.roomRepository = new JsonRepository<Room>(databaseManager, "Room");
  }


  setLiveUpdateService(service: LiveUpdateService): void {
    this.liveUpdateService = service;
  }

  findAllRooms(): Room[] {
    return this.roomRepository.findAll();
  }

  addRoom(body: Room): Room {
    const room = body;
    if (!room.id) room.id = `room-${randomUUID()}`;

    if (room.index === undefined || room.index === null) {
      const floorPlan = this.floorPlanRepository.findById(MAIN_FLOORPLAN_ID) ?? { rooms: [] };
      if (!Array.isArray(floorPlan.rooms)) floorPlan.rooms = [];
      const maxIndex = floorPlan.rooms.reduce((max, r) => {
        const idx = r.index ?? -1;
        return idx > max ? idx : max;
      }, -1);
      room.index = maxIndex + 1;
    }

    this.roomRepository.save(room.id, room);

    const floorPlan = this.floorPlanRepository.findById(MAIN_FLOORPLAN_ID) ?? { rooms: [] };
    if (!Array.isArray(floorPlan.rooms)) floorPlan.rooms = [];
    floorPlan.rooms = floorPlan.rooms.filter(existing => existing.id !== room.id);
    floorPlan.rooms.push(room);
    this.floorPlanRepository.save(MAIN_FLOORPLAN_ID, floorPlan);

    return room;
  }

  updateRoom(roomId: string, body: Room): Room {
    const room = body;
    room.id = roomId;
    this.roomRepository.save(room.id, room);

    const floorPlan = this.floorPlanRepository.findById(MAIN_FLOORPLAN_ID);
    if (floorPlan && Array.isArray(floorPlan.rooms)) {
      floorPlan.rooms = floorPlan.rooms.filter(existing => existing.id !== room.id);
      floorPlan.rooms.push(room);
      this.floorPlanRepository.save(MAIN_FLOORPLAN_ID, floorPlan);
    }

    return room;
  }

  deleteRoom(roomId: string): boolean {
    const deleted = this.roomRepository.deleteById(roomId);
    if (!deleted) return false;
    const floorPlan = this.floorPlanRepository.findById(MAIN_FLOORPLAN_ID);
    if (floorPlan && Array.isArray(floorPlan.rooms)) {
      floorPlan.rooms = floorPlan.rooms.filter(existing => existing.id !== roomId);
      this.floorPlanRepository.save(MAIN_FLOORPLAN_ID, floorPlan);
    }
    this.deviceManager.removeRoomFromDevices(roomId);
    return true;
  }
}
