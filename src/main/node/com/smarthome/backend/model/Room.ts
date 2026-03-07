import type { Position } from "../server/actions/action/Position.js";

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
  points?: Position[];
  index?: number;

  constructor(init?: Partial<Room>) {
    Object.assign(this, init);
  }
}
