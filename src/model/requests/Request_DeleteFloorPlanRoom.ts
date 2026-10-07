/** DELETE /api/floorplan/rooms/:roomId */
export class Request_DeleteFloorPlanRoom {
  readonly roomId!: string;

  constructor(fields: Request_DeleteFloorPlanRoom) {
    Object.assign(this, fields);
  }
}
