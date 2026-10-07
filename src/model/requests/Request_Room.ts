/** Eckpunkt eines Raum-Polygons. */
export class Request_RoomPoint {
  readonly x?: number | null;
  readonly y?: number | null;
}

/** Raum innerhalb des Grundrisses (PUT /api/floorplan). */
export class Request_Room {
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
}
