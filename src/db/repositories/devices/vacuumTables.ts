import type { RowDataPacket } from "mysql2/promise";
import { DeviceType } from "../../../model/devices/helper/DeviceType.js";
import { DbDeviceVacuum } from "../../../model/db/DbDeviceVacuum.js";
import { DbDeviceVacuumRoomAssignment } from "../../../model/db/DbDeviceVacuumRoomAssignment.js";
import {
  assignIfSet,
  groupByDevice,
  isRecord,
  toNullableBoolean,
  toNullableNumber,
  toNullableString,
  type DeviceTableGroup
} from "./deviceTableGroup.js";

const SQL_SELECT_VACUUMS = `
  SELECT
      v.device_id               AS deviceId,
      v.is_powered              AS isPowered,
      v.is_cleaning             AS isCleaning,
      v.is_docked               AS isDocked,
      v.battery,
      v.fan_speed               AS fanSpeed,
      v.water_box_level         AS waterBoxLevel,
      v.dirty_water_box_level   AS dirtyWaterBoxLevel,
      v.is_water_box_full       AS isWaterBoxFull,
      v.is_dirty_water_box_full AS isDirtyWaterBoxFull,
      v.current_room            AS currentRoom,
      v.current_zone            AS currentZone,
      v.mode,
      v.error_message           AS errorMessage
  FROM device_vacuums AS v`;

const SQL_UPSERT_VACUUM = `
  INSERT INTO device_vacuums (
      device_id, is_powered, is_cleaning, is_docked, battery, fan_speed,
      water_box_level, dirty_water_box_level, is_water_box_full, is_dirty_water_box_full,
      current_room, current_zone, mode, error_message
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      is_powered              = incoming.is_powered,
      is_cleaning             = incoming.is_cleaning,
      is_docked               = incoming.is_docked,
      battery                 = incoming.battery,
      fan_speed               = incoming.fan_speed,
      water_box_level         = incoming.water_box_level,
      dirty_water_box_level   = incoming.dirty_water_box_level,
      is_water_box_full       = incoming.is_water_box_full,
      is_dirty_water_box_full = incoming.is_dirty_water_box_full,
      current_room            = incoming.current_room,
      current_zone            = incoming.current_zone,
      mode                    = incoming.mode,
      error_message           = incoming.error_message`;

const SQL_SELECT_ROOM_ASSIGNMENTS = `
  SELECT
      a.device_id      AS deviceId,
      a.vacuum_room_id AS vacuumRoomId,
      a.room_id        AS roomId
  FROM device_vacuum_room_assignments AS a
  ORDER BY a.device_id, a.vacuum_room_id`;

const SQL_DELETE_ROOM_ASSIGNMENTS = `
  DELETE FROM device_vacuum_room_assignments
  WHERE device_id = ?`;

/** Zuordnungen zu nicht (mehr) vorhandenen Räumen werden übersprungen statt am Fremdschlüssel zu scheitern. */
const SQL_INSERT_ROOM_ASSIGNMENT = `
  INSERT INTO device_vacuum_room_assignments (device_id, vacuum_room_id, room_id)
  SELECT ?, ?, r.id
  FROM rooms AS r
  WHERE r.id = ?`;

/** Saugroboter inkl. Zuordnung seiner Raum-IDs zu den Räumen im Grundriss (Feld `roomMapping`). */
export const vacuumTables: DeviceTableGroup = {
  appliesTo: device => device.type === DeviceType.VACUUM,

  async load(db, devices) {
    for (const row of await db.query<RowDataPacket>(SQL_SELECT_VACUUMS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const vacuum = new DbDeviceVacuum({
        deviceId: row.deviceId,
        isPowered: toNullableBoolean(row.isPowered),
        isCleaning: toNullableBoolean(row.isCleaning),
        isDocked: toNullableBoolean(row.isDocked),
        battery: toNullableNumber(row.battery),
        fanSpeed: toNullableNumber(row.fanSpeed),
        waterBoxLevel: toNullableNumber(row.waterBoxLevel),
        dirtyWaterBoxLevel: toNullableNumber(row.dirtyWaterBoxLevel),
        isWaterBoxFull: toNullableBoolean(row.isWaterBoxFull),
        isDirtyWaterBoxFull: toNullableBoolean(row.isDirtyWaterBoxFull),
        currentRoom: row.currentRoom,
        currentZone: row.currentZone,
        mode: row.mode,
        errorMessage: row.errorMessage
      });
      assignIfSet(device, "power", vacuum.isPowered);
      assignIfSet(device, "cleaningState", vacuum.isCleaning);
      assignIfSet(device, "dockedState", vacuum.isDocked);
      assignIfSet(device, "battery", vacuum.battery);
      assignIfSet(device, "fanSpeed", vacuum.fanSpeed);
      assignIfSet(device, "waterBoxLevel", vacuum.waterBoxLevel);
      assignIfSet(device, "dirtyWaterBoxLevel", vacuum.dirtyWaterBoxLevel);
      assignIfSet(device, "waterBoxFullState", vacuum.isWaterBoxFull);
      assignIfSet(device, "dirtyWaterBoxFullState", vacuum.isDirtyWaterBoxFull);
      assignIfSet(device, "currentRoom", vacuum.currentRoom);
      assignIfSet(device, "currentZone", vacuum.currentZone);
      assignIfSet(device, "mode", vacuum.mode);
      assignIfSet(device, "error", vacuum.errorMessage);
    }

    for (const [deviceId, rows] of groupByDevice(await db.query<RowDataPacket>(SQL_SELECT_ROOM_ASSIGNMENTS))) {
      const device = devices.get(deviceId);
      if (!device) continue;
      const roomMapping: Record<string, string> = {};
      for (const row of rows) {
        const assignment = new DbDeviceVacuumRoomAssignment({
          deviceId,
          vacuumRoomId: row.vacuumRoomId,
          roomId: row.roomId
        });
        roomMapping[assignment.vacuumRoomId] = assignment.roomId;
      }
      device.roomMapping = roomMapping;
    }
  },

  async save(tx, device) {
    const vacuum = new DbDeviceVacuum({
      deviceId: device.id,
      isPowered: toNullableBoolean(device.power),
      isCleaning: toNullableBoolean(device.cleaningState),
      isDocked: toNullableBoolean(device.dockedState),
      battery: toNullableNumber(device.battery),
      fanSpeed: toNullableNumber(device.fanSpeed),
      waterBoxLevel: toNullableNumber(device.waterBoxLevel),
      dirtyWaterBoxLevel: toNullableNumber(device.dirtyWaterBoxLevel),
      isWaterBoxFull: toNullableBoolean(device.waterBoxFullState),
      isDirtyWaterBoxFull: toNullableBoolean(device.dirtyWaterBoxFullState),
      currentRoom: toNullableString(device.currentRoom),
      currentZone: toNullableString(device.currentZone),
      mode: toNullableString(device.mode),
      errorMessage: toNullableString(device.error)
    });
    await tx.execute(SQL_UPSERT_VACUUM, [
      vacuum.deviceId,
      vacuum.isPowered,
      vacuum.isCleaning,
      vacuum.isDocked,
      vacuum.battery,
      vacuum.fanSpeed,
      vacuum.waterBoxLevel,
      vacuum.dirtyWaterBoxLevel,
      vacuum.isWaterBoxFull,
      vacuum.isDirtyWaterBoxFull,
      vacuum.currentRoom,
      vacuum.currentZone,
      vacuum.mode,
      vacuum.errorMessage
    ]);

    await tx.execute(SQL_DELETE_ROOM_ASSIGNMENTS, [device.id]);
    const roomMapping = isRecord(device.roomMapping) ? device.roomMapping : {};
    for (const [vacuumRoomId, roomId] of Object.entries(roomMapping)) {
      if (typeof roomId !== "string" || roomId === "") continue;
      const assignment = new DbDeviceVacuumRoomAssignment({ deviceId: device.id, vacuumRoomId, roomId });
      await tx.execute(SQL_INSERT_ROOM_ASSIGNMENT, [
        assignment.deviceId,
        assignment.vacuumRoomId,
        assignment.roomId
      ]);
    }
  }
};
