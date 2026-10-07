/** Zeile der Tabelle `device_vacuum_room_assignments`. */
export class DbDeviceVacuumRoomAssignment {
  readonly deviceId!: string;
  readonly vacuumRoomId!: string;
  readonly roomId!: string;

  constructor(fields: DbDeviceVacuumRoomAssignment) {
    Object.assign(this, fields);
  }
}
