import type { Room } from "../Room.js";

/** Raum, wie ihn die Raum-Endpunkte des Grundrisses zurückgeben. */
export class Response_Room {
  constructor(readonly room: Room) {}

  toJSON(): Room {
    return this.room;
  }
}
