import type { FloorPlan } from "../FloorPlan.js";

/** Grundriss, wie ihn die Grundriss-Endpunkte zurückgeben: `{ rooms }`. */
export class Response_FloorPlan {
  constructor(readonly floorPlan: FloorPlan) {}

  toJSON(): FloorPlan {
    return this.floorPlan;
  }
}
