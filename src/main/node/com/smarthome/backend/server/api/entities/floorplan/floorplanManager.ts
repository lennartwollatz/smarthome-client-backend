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

  /**
   * Setzt die Sortierindizes aller übergebenen Räume anhand der Reihenfolge in `roomIds`
   * (0 … n‑1) und persistiert jeden Raum sowie die eingebettete FloorPlan-Liste.
   */
  reorderRooms(roomIds: string[]): Room[] {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (let i = 0; i < roomIds.length; i++) {
      const raw = roomIds[i];
      if (typeof raw !== "string" || !raw.trim()) {
        throw new Error(`Invalid room id at index ${i}`);
      }
      if (seen.has(raw)) {
        throw new Error(`Duplicate room id in reorder: ${raw}`);
      }
      seen.add(raw);
      if (!this.roomRepository.findById(raw)) {
        throw new Error(`Room not found: ${raw}`);
      }
      ids.push(raw);
    }

    const reordered: Room[] = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const existing = this.roomRepository.findById(id)!;
      const room: Room = { ...existing, id, index: i };
      this.roomRepository.save(id, room);
      reordered.push(room);
    }

    const idSet = new Set(ids);
    const notOrdered = this.roomRepository.findAll().filter(r => r.id && !idSet.has(r.id));
    let next = ids.length;
    const tailReindexed: Room[] = [];
    for (const tr of notOrdered) {
      const id = tr.id!;
      const existing = this.roomRepository.findById(id)!;
      const room: Room = { ...existing, id, index: next };
      next++;
      this.roomRepository.save(id, room);
      tailReindexed.push(room);
    }

    const floorPlan = this.floorPlanRepository.findById(MAIN_FLOORPLAN_ID) ?? { rooms: [] };
    if (!Array.isArray(floorPlan.rooms)) floorPlan.rooms = [];
    floorPlan.rooms = [...reordered, ...tailReindexed];
    this.floorPlanRepository.save(MAIN_FLOORPLAN_ID, floorPlan);

    return this.findAllRooms();
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
