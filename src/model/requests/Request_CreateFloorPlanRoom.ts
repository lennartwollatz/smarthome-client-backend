import type { Request_RoomPoint } from "./Request_Room.js";

/** POST /api/floorplan/rooms */
export class Request_CreateFloorPlanRoom {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly icon?: string | null;
  readonly color?: string | null;
  readonly temperature?: number | null;
  readonly x?: number | null;
  readonly y?: number | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly index?: number | null;
  readonly points?: Request_RoomPoint[] | null;

  constructor(fields: Request_CreateFloorPlanRoom) {
    Object.assign(this, fields);
  }
}
