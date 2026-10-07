import type { RowDataPacket } from "mysql2/promise";
import { DeviceType } from "../../../model/devices/helper/DeviceType.js";
import { DbDeviceFan } from "../../../model/db/DbDeviceFan.js";
import { DbDeviceLight } from "../../../model/db/DbDeviceLight.js";
import type { SqlExecutor } from "../../database.js";
import {
  assignIfSet,
  toNullableBoolean,
  toNullableNumber,
  type DeviceTableGroup,
  type PlainDevice
} from "./deviceTableGroup.js";

const SQL_SELECT_LIGHTS = `
  SELECT
      l.device_id         AS deviceId,
      l.is_on             AS isOn,
      l.brightness,
      l.color_temperature AS colorTemperature,
      l.color_x           AS colorX,
      l.color_y           AS colorY
  FROM device_lights AS l`;

const SQL_UPSERT_LIGHT = `
  INSERT INTO device_lights (device_id, is_on, brightness, color_temperature, color_x, color_y)
  VALUES (?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      is_on             = incoming.is_on,
      brightness        = incoming.brightness,
      color_temperature = incoming.color_temperature,
      color_x           = incoming.color_x,
      color_y           = incoming.color_y`;

const SQL_SELECT_FANS = `
  SELECT
      f.device_id        AS deviceId,
      f.speed,
      f.is_light_on      AS isLightOn,
      f.light_brightness AS lightBrightness
  FROM device_fans AS f`;

const SQL_UPSERT_FAN = `
  INSERT INTO device_fans (device_id, speed, is_light_on, light_brightness)
  VALUES (?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      speed            = incoming.speed,
      is_light_on      = incoming.is_light_on,
      light_brightness = incoming.light_brightness`;

const FAN_TYPES = new Set<string>([DeviceType.FAN, DeviceType.FAN_LIGHT, DeviceType.FAN_LIGHT_DIMMER]);

const LIGHT_TYPES = new Set<string>([
  DeviceType.LIGHT,
  DeviceType.LIGHT_DIMMER,
  DeviceType.LIGHT_DIMMER_TEMPERATURE,
  DeviceType.LIGHT_DIMMER_TEMPERATURE_COLOR,
  ...FAN_TYPES
]);

/** Leuchten (inkl. Lüfter, die von DeviceLight erben); `temperature` ist hier die Farbtemperatur. */
export const lightTables: DeviceTableGroup = {
  appliesTo: device => LIGHT_TYPES.has(device.type ?? ""),

  async load(db, devices) {
    const rows = await db.query<RowDataPacket>(SQL_SELECT_LIGHTS);
    for (const row of rows) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const light = new DbDeviceLight({
        deviceId: row.deviceId,
        isOn: toNullableBoolean(row.isOn),
        brightness: toNullableNumber(row.brightness),
        colorTemperature: toNullableNumber(row.colorTemperature),
        colorX: toNullableNumber(row.colorX),
        colorY: toNullableNumber(row.colorY)
      });
      assignIfSet(device, "on", light.isOn);
      assignIfSet(device, "brightness", light.brightness);
      assignIfSet(device, "temperature", light.colorTemperature);
      assignIfSet(device, "colorX", light.colorX);
      assignIfSet(device, "colorY", light.colorY);
    }
  },

  async save(tx, device) {
    const light = new DbDeviceLight({
      deviceId: device.id,
      isOn: toNullableBoolean(device.on),
      brightness: toNullableNumber(device.brightness),
      colorTemperature: toNullableNumber(device.temperature),
      colorX: toNullableNumber(device.colorX),
      colorY: toNullableNumber(device.colorY)
    });
    await tx.execute(SQL_UPSERT_LIGHT, [
      light.deviceId,
      light.isOn,
      light.brightness,
      light.colorTemperature,
      light.colorX,
      light.colorY
    ]);
  }
};

export const fanTables: DeviceTableGroup = {
  appliesTo: device => FAN_TYPES.has(device.type ?? ""),

  async load(db, devices) {
    const rows = await db.query<RowDataPacket>(SQL_SELECT_FANS);
    for (const row of rows) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const fan = new DbDeviceFan({
        deviceId: row.deviceId,
        speed: toNullableNumber(row.speed),
        isLightOn: toNullableBoolean(row.isLightOn),
        lightBrightness: toNullableNumber(row.lightBrightness)
      });
      assignIfSet(device, "speed", fan.speed);
      assignIfSet(device, "lightOn", fan.isLightOn);
      assignIfSet(device, "lightBrightness", fan.lightBrightness);
    }
  },

  async save(tx: SqlExecutor, device: PlainDevice) {
    const fan = new DbDeviceFan({
      deviceId: device.id,
      speed: toNullableNumber(device.speed),
      isLightOn: toNullableBoolean(device.lightOn),
      lightBrightness: toNullableNumber(device.lightBrightness)
    });
    await tx.execute(SQL_UPSERT_FAN, [fan.deviceId, fan.speed, fan.isLightOn, fan.lightBrightness]);
  }
};
