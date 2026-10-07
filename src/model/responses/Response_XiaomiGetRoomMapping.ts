export type Response_XiaomiRoomMappingEntry = {
  roomId: number;
  segmentId: string;
  attribute: number;
};

/** GET /api/modules/xiaomi/devices/:deviceId/roomMapping – Antwort ist das Array der Raumzuordnungen. */
export class Response_XiaomiGetRoomMapping {
  constructor(readonly rooms: Response_XiaomiRoomMappingEntry[]) {}

  toJSON(): Response_XiaomiRoomMappingEntry[] {
    return this.rooms;
  }
}
