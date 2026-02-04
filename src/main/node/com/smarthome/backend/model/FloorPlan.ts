import { Room } from "./Room.js";
export class FloorPlan {
  rooms?: Room[];

  constructor(init?: Partial<FloorPlan>) {
    Object.assign(this, init);
  }
}
