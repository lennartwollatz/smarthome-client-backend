import type { Point } from "./Point.js";

export class Room {
  id?: string;
  name?: string;
  icon?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
  temperature?: number;
  points?: Point[];
  index?: number;

  constructor(init?: Partial<Room>) {
    Object.assign(this, init);
  }
}
