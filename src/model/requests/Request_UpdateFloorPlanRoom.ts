import type { Request_RoomPoint } from "./Request_Room.js";

/** PUT /api/floorplan/rooms/:roomId */
export class Request_UpdateFloorPlanRoom {
  readonly roomId!: string;
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

  constructor(fields: Request_UpdateFloorPlanRoom) {
    Object.assign(this, fields);
  }
}
