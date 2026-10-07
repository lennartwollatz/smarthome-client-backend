import type { Request_Room } from "./Request_Room.js";

/** PUT /api/floorplan – ersetzt den kompletten Grundriss. */
export class Request_UpdateFloorPlan {
  readonly rooms?: Request_Room[] | null;

  constructor(fields: Request_UpdateFloorPlan) {
    Object.assign(this, fields);
  }
}
