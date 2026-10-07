import type { RowDataPacket } from "mysql2/promise";
import { DeviceType } from "../../../model/devices/helper/DeviceType.js";
import { DbDevicePresence } from "../../../model/db/DbDevicePresence.js";
import { toNullableBoolean, type DeviceTableGroup } from "./deviceTableGroup.js";

const SQL_SELECT_PRESENCES = `
  SELECT
      p.device_id  AS deviceId,
      p.is_present AS isPresent
  FROM device_presences AS p`;

const SQL_UPSERT_PRESENCE = `
  INSERT INTO device_presences (device_id, is_present)
  VALUES (?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      is_present = incoming.is_present`;

export const presenceTables: DeviceTableGroup = {
  appliesTo: device => device.type === DeviceType.PRESENCE,

  async load(db, devices) {
    for (const row of await db.query<RowDataPacket>(SQL_SELECT_PRESENCES)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const presence = new DbDevicePresence({
        deviceId: row.deviceId,
        isPresent: toNullableBoolean(row.isPresent) ?? false
      });
      device.present = presence.isPresent;
    }
  },

  async save(tx, device) {
    const presence = new DbDevicePresence({
      deviceId: device.id,
      isPresent: toNullableBoolean(device.present) ?? false
    });
    await tx.execute(SQL_UPSERT_PRESENCE, [presence.deviceId, presence.isPresent]);
  }
};
