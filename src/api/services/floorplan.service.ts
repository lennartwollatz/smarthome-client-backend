import { randomUUID } from "node:crypto";
import type { ActionManager } from "../../actions/ActionManager.js";
import { Position } from "../../actions/action/Position.js";
import type { RoomRepository } from "../../db/repositories/RoomRepository.js";
import { FloorPlan } from "../../model/FloorPlan.js";
import { Room } from "../../model/Room.js";
import type { Request_CreateFloorPlanRoom } from "../../model/requests/Request_CreateFloorPlanRoom.js";
import type { Request_DeleteFloorPlanRoom } from "../../model/requests/Request_DeleteFloorPlanRoom.js";
import type { Request_GetFloorPlan } from "../../model/requests/Request_GetFloorPlan.js";
import type { Request_Room } from "../../model/requests/Request_Room.js";
import type { Request_UpdateFloorPlan } from "../../model/requests/Request_UpdateFloorPlan.js";
import type { Request_UpdateFloorPlanRoom } from "../../model/requests/Request_UpdateFloorPlanRoom.js";
import { Response_CreateFloorPlanRoom } from "../../model/responses/Response_CreateFloorPlanRoom.js";
import { Response_DeleteFloorPlanRoom } from "../../model/responses/Response_DeleteFloorPlanRoom.js";
import { Response_GetFloorPlan } from "../../model/responses/Response_GetFloorPlan.js";
import { Response_UpdateFloorPlan } from "../../model/responses/Response_UpdateFloorPlan.js";
import { Response_UpdateFloorPlanRoom } from "../../model/responses/Response_UpdateFloorPlanRoom.js";
import { ApiError } from "../http/ApiError.js";

const ROOM_NOT_FOUND = "Room not found";

type RoomFields = Omit<Request_Room, "id">;

export class FloorPlanService {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly actionManager: ActionManager
  ) {}

  async getFloorPlan(_request: Request_GetFloorPlan): Promise<Response_GetFloorPlan> {
    const rooms = await this.roomRepository.findAll();
    return new Response_GetFloorPlan(new FloorPlan({ rooms }));
  }

  async updateFloorPlan(request: Request_UpdateFloorPlan): Promise<Response_UpdateFloorPlan> {
    const rooms = (request.rooms ?? []).map(room =>
      toRoom(room, room.id || newRoomId(), room.index ?? undefined)
    );
    const removedRoomIds = await this.roomRepository.replaceAll(rooms);
    removedRoomIds.forEach(roomId => this.actionManager.removeRoomFromDevices(roomId));
    return new Response_UpdateFloorPlan(new FloorPlan({ rooms }));
  }

  async createRoom(request: Request_CreateFloorPlanRoom): Promise<Response_CreateFloorPlanRoom> {
    const index = request.index ?? (await this.roomRepository.findNextSortIndex());
    const room = toRoom(request, request.id || newRoomId(), index);
    await this.roomRepository.save(room);
    return new Response_CreateFloorPlanRoom(room);
  }

  async updateRoom(request: Request_UpdateFloorPlanRoom): Promise<Response_UpdateFloorPlanRoom> {
    const index = request.index ?? (await this.existingOrNextIndex(request.roomId));
    const room = toRoom(request, request.roomId, index);
    await this.roomRepository.save(room);
    return new Response_UpdateFloorPlanRoom(room);
  }

  async deleteRoom(request: Request_DeleteFloorPlanRoom): Promise<Response_DeleteFloorPlanRoom> {
    if (!(await this.roomRepository.deleteById(request.roomId))) {
      throw ApiError.notFound(ROOM_NOT_FOUND);
    }
    this.actionManager.removeRoomFromDevices(request.roomId);
    return new Response_DeleteFloorPlanRoom();
  }

  private async existingOrNextIndex(roomId: string): Promise<number> {
    const existing = await this.roomRepository.findById(roomId);
    return existing?.index ?? (await this.roomRepository.findNextSortIndex());
  }
}

function newRoomId(): string {
  return `room-${randomUUID()}`;
}

function toRoom(fields: RoomFields, id: string, index: number | undefined): Room {
  return new Room({
    id,
    name: fields.name ?? undefined,
    icon: fields.icon ?? undefined,
    color: fields.color ?? undefined,
    temperature: fields.temperature ?? undefined,
    x: fields.x ?? undefined,
    y: fields.y ?? undefined,
    width: fields.width ?? undefined,
    height: fields.height ?? undefined,
    index,
    points: fields.points?.map(point => new Position({ x: point.x ?? undefined, y: point.y ?? undefined }))
  });
}
