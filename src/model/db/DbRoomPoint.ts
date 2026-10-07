/** Zeile der Tabelle `room_points`. */
export class DbRoomPoint {
  readonly roomId!: string;
  readonly pointIndex!: number;
  readonly x!: number;
  readonly y!: number;

  constructor(fields: DbRoomPoint) {
    Object.assign(this, fields);
  }
}
