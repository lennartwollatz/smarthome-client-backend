import type { RowDataPacket } from "mysql2/promise";
import { DeviceType } from "../../../model/devices/helper/DeviceType.js";
import { DbDeviceLightLevelSensor } from "../../../model/db/DbDeviceLightLevelSensor.js";
import { DbDeviceMotionSensor } from "../../../model/db/DbDeviceMotionSensor.js";
import { DbDeviceTemperatureReading } from "../../../model/db/DbDeviceTemperatureReading.js";
import { DbDeviceTemperatureSensor } from "../../../model/db/DbDeviceTemperatureSensor.js";
import { DbDeviceThermostat } from "../../../model/db/DbDeviceThermostat.js";
import { DbDeviceThermostatSchedule } from "../../../model/db/DbDeviceThermostatSchedule.js";
import { DbDeviceThermostatScheduleTime } from "../../../model/db/DbDeviceThermostatScheduleTime.js";
import {
  asRecordArray,
  assignIfSet,
  groupByDevice,
  replaceRows,
  toNullableBoolean,
  toNullableNumber,
  toNullableString,
  type DeviceTableGroup
} from "./deviceTableGroup.js";

const SQL_SELECT_MOTION_SENSORS = `
  SELECT
      m.device_id            AS deviceId,
      m.sensitivity,
      m.is_motion            AS isMotion,
      m.motion_last_detected AS motionLastDetected
  FROM device_motion_sensors AS m`;

const SQL_UPSERT_MOTION_SENSOR = `
  INSERT INTO device_motion_sensors (device_id, sensitivity, is_motion, motion_last_detected)
  VALUES (?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      sensitivity          = incoming.sensitivity,
      is_motion            = incoming.is_motion,
      motion_last_detected = incoming.motion_last_detected`;

const SQL_SELECT_LIGHT_LEVEL_SENSORS = `
  SELECT
      s.device_id   AS deviceId,
      s.light_level AS lightLevel
  FROM device_light_level_sensors AS s`;

const SQL_UPSERT_LIGHT_LEVEL_SENSOR = `
  INSERT INTO device_light_level_sensors (device_id, light_level)
  VALUES (?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      light_level = incoming.light_level`;

const SQL_SELECT_TEMPERATURE_SENSORS = `
  SELECT
      t.device_id AS deviceId,
      t.temperature
  FROM device_temperature_sensors AS t`;

const SQL_UPSERT_TEMPERATURE_SENSOR = `
  INSERT INTO device_temperature_sensors (device_id, temperature)
  VALUES (?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      temperature = incoming.temperature`;

const SQL_SELECT_TEMPERATURE_READINGS = `
  SELECT
      r.device_id        AS deviceId,
      r.sort_index       AS sortIndex,
      r.recorded_at      AS recordedAt,
      r.temperature,
      r.temperature_goal AS temperatureGoal
  FROM device_temperature_readings AS r
  ORDER BY r.device_id, r.sort_index`;

const SQL_DELETE_TEMPERATURE_READINGS = `
  DELETE FROM device_temperature_readings
  WHERE device_id = ?`;

const SQL_INSERT_TEMPERATURE_READING = `
  INSERT INTO device_temperature_readings (device_id, sort_index, recorded_at, temperature, temperature_goal)
  VALUES (?, ?, ?, ?, ?)`;

const SQL_SELECT_THERMOSTATS = `
  SELECT
      t.device_id        AS deviceId,
      t.temperature_goal AS temperatureGoal
  FROM device_thermostats AS t`;

const SQL_UPSERT_THERMOSTAT = `
  INSERT INTO device_thermostats (device_id, temperature_goal)
  VALUES (?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      temperature_goal = incoming.temperature_goal`;

const SQL_SELECT_THERMOSTAT_SCHEDULES = `
  SELECT
      s.device_id      AS deviceId,
      s.schedule_index AS scheduleIndex,
      s.rule_name      AS ruleName,
      s.is_active      AS isActive
  FROM device_thermostat_schedules AS s
  ORDER BY s.device_id, s.schedule_index`;

const SQL_SELECT_THERMOSTAT_SCHEDULE_TIMES = `
  SELECT
      t.device_id      AS deviceId,
      t.schedule_index AS scheduleIndex,
      t.time_index     AS timeIndex,
      t.weekday,
      t.time_of_day    AS timeOfDay,
      t.temperature
  FROM device_thermostat_schedule_times AS t
  ORDER BY t.device_id, t.schedule_index, t.time_index`;

/** Löscht über ON DELETE CASCADE auch die Zeitfenster. */
const SQL_DELETE_THERMOSTAT_SCHEDULES = `
  DELETE FROM device_thermostat_schedules
  WHERE device_id = ?`;

const SQL_INSERT_THERMOSTAT_SCHEDULE = `
  INSERT INTO device_thermostat_schedules (device_id, schedule_index, rule_name, is_active)
  VALUES (?, ?, ?, ?)`;

const SQL_INSERT_THERMOSTAT_SCHEDULE_TIME = `
  INSERT INTO device_thermostat_schedule_times (device_id, schedule_index, time_index, weekday, time_of_day, temperature)
  VALUES (?, ?, ?, ?, ?, ?)`;

const MOTION_TYPES = new Set<string>([
  DeviceType.MOTION,
  DeviceType.MOTION_LIGHT_LEVEL,
  DeviceType.MOTION_LIGHT_LEVEL_TEMPERATURE
]);

const LIGHT_LEVEL_TYPES = new Set<string>([
  DeviceType.LIGHT_LEVEL,
  DeviceType.MOTION_LIGHT_LEVEL,
  DeviceType.MOTION_LIGHT_LEVEL_TEMPERATURE
]);

const TEMPERATURE_TYPES = new Set<string>([
  DeviceType.TEMPERATURE,
  DeviceType.THERMOSTAT,
  DeviceType.MOTION_LIGHT_LEVEL_TEMPERATURE
]);

/** Nur DeviceTemperature und DeviceThermostat führen einen Verlauf. */
const TEMPERATURE_HISTORY_TYPES = new Set<string>([DeviceType.TEMPERATURE, DeviceType.THERMOSTAT]);

export const motionSensorTables: DeviceTableGroup = {
  appliesTo: device => MOTION_TYPES.has(device.type ?? ""),

  async load(db, devices) {
    const rows = await db.query<RowDataPacket>(SQL_SELECT_MOTION_SENSORS);
    for (const row of rows) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const sensor = new DbDeviceMotionSensor({
        deviceId: row.deviceId,
        sensitivity: toNullableNumber(row.sensitivity),
        isMotion: toNullableBoolean(row.isMotion),
        motionLastDetected: row.motionLastDetected
      });
      assignIfSet(device, "sensitivity", sensor.sensitivity);
      assignIfSet(device, "motion", sensor.isMotion);
      assignIfSet(device, "motion_last_detect", sensor.motionLastDetected);
    }
  },

  async save(tx, device) {
    const sensor = new DbDeviceMotionSensor({
      deviceId: device.id,
      sensitivity: toNullableNumber(device.sensitivity),
      isMotion: toNullableBoolean(device.motion),
      motionLastDetected: toNullableString(device.motion_last_detect)
    });
    await tx.execute(SQL_UPSERT_MOTION_SENSOR, [
      sensor.deviceId,
      sensor.sensitivity,
      sensor.isMotion,
      sensor.motionLastDetected
    ]);
  }
};

export const lightLevelSensorTables: DeviceTableGroup = {
  appliesTo: device => LIGHT_LEVEL_TYPES.has(device.type ?? ""),

  async load(db, devices) {
    const rows = await db.query<RowDataPacket>(SQL_SELECT_LIGHT_LEVEL_SENSORS);
    for (const row of rows) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const sensor = new DbDeviceLightLevelSensor({
        deviceId: row.deviceId,
        lightLevel: toNullableNumber(row.lightLevel)
      });
      assignIfSet(device, "lightLevel", sensor.lightLevel);
    }
  },

  async save(tx, device) {
    const sensor = new DbDeviceLightLevelSensor({
      deviceId: device.id,
      lightLevel: toNullableNumber(device.lightLevel)
    });
    await tx.execute(SQL_UPSERT_LIGHT_LEVEL_SENSOR, [sensor.deviceId, sensor.lightLevel]);
  }
};

export const temperatureSensorTables: DeviceTableGroup = {
  appliesTo: device => TEMPERATURE_TYPES.has(device.type ?? ""),

  async load(db, devices) {
    const sensors = await db.query<RowDataPacket>(SQL_SELECT_TEMPERATURE_SENSORS);
    for (const row of sensors) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const sensor = new DbDeviceTemperatureSensor({
        deviceId: row.deviceId,
        temperature: toNullableNumber(row.temperature)
      });
      assignIfSet(device, "temperature", sensor.temperature);
    }

    const readings = await db.query<RowDataPacket>(SQL_SELECT_TEMPERATURE_READINGS);
    for (const [deviceId, deviceRows] of groupByDevice(readings)) {
      const device = devices.get(deviceId);
      if (!device) continue;
      device.temperatureHistory = deviceRows
        .map(row => new DbDeviceTemperatureReading({
          deviceId,
          sortIndex: row.sortIndex,
          recordedAt: Number(row.recordedAt),
          temperature: Number(row.temperature),
          temperatureGoal: Number(row.temperatureGoal)
        }))
        .map(reading => ({
          datetime: reading.recordedAt,
          temperature: reading.temperature,
          temperatureGoal: reading.temperatureGoal
        }));
    }
  },

  async save(tx, device) {
    const sensor = new DbDeviceTemperatureSensor({
      deviceId: device.id,
      temperature: toNullableNumber(device.temperature)
    });
    await tx.execute(SQL_UPSERT_TEMPERATURE_SENSOR, [sensor.deviceId, sensor.temperature]);

    if (!TEMPERATURE_HISTORY_TYPES.has(device.type ?? "")) return;
    const readings = asRecordArray(device.temperatureHistory).map((entry, sortIndex) => new DbDeviceTemperatureReading({
      deviceId: device.id,
      sortIndex,
      recordedAt: toNullableNumber(entry.datetime) ?? 0,
      temperature: toNullableNumber(entry.temperature) ?? 0,
      temperatureGoal: toNullableNumber(entry.temperatureGoal) ?? -999
    }));
    await replaceRows(tx, SQL_DELETE_TEMPERATURE_READINGS, SQL_INSERT_TEMPERATURE_READING, device.id, readings.map(reading => [
      reading.deviceId,
      reading.sortIndex,
      reading.recordedAt,
      reading.temperature,
      reading.temperatureGoal
    ]));
  }
};

/** Zieltemperatur und Zeitpläne (Feld `temperatureSchedule`: Regeln mit Zeitfenstern in `rulevalue`). */
export const thermostatTables: DeviceTableGroup = {
  appliesTo: device => device.type === DeviceType.THERMOSTAT,

  async load(db, devices) {
    const thermostats = await db.query<RowDataPacket>(SQL_SELECT_THERMOSTATS);
    for (const row of thermostats) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const thermostat = new DbDeviceThermostat({
        deviceId: row.deviceId,
        temperatureGoal: Number(row.temperatureGoal)
      });
      device.temperatureGoal = thermostat.temperatureGoal;
    }

    const timeRows = await db.query<RowDataPacket>(SQL_SELECT_THERMOSTAT_SCHEDULE_TIMES);
    const timesBySchedule = new Map<string, DbDeviceThermostatScheduleTime[]>();
    for (const row of timeRows) {
      const time = new DbDeviceThermostatScheduleTime({
        deviceId: row.deviceId,
        scheduleIndex: row.scheduleIndex,
        timeIndex: row.timeIndex,
        weekday: Number(row.weekday),
        timeOfDay: row.timeOfDay,
        temperature: Number(row.temperature)
      });
      const key = `${time.deviceId}\u0000${time.scheduleIndex}`;
      const list = timesBySchedule.get(key);
      if (list) list.push(time);
      else timesBySchedule.set(key, [time]);
    }

    const scheduleRows = await db.query<RowDataPacket>(SQL_SELECT_THERMOSTAT_SCHEDULES);
    for (const [deviceId, deviceRows] of groupByDevice(scheduleRows)) {
      const device = devices.get(deviceId);
      if (!device) continue;
      device.temperatureSchedule = deviceRows.map(row => {
        const schedule = new DbDeviceThermostatSchedule({
          deviceId,
          scheduleIndex: row.scheduleIndex,
          ruleName: row.ruleName,
          isActive: toNullableBoolean(row.isActive) ?? false
        });
        const times = timesBySchedule.get(`${deviceId}\u0000${schedule.scheduleIndex}`) ?? [];
        return {
          rulename: schedule.ruleName,
          active: schedule.isActive,
          rulevalue: times.map(time => ({
            weekday: time.weekday,
            time: time.timeOfDay,
            temperature: time.temperature
          }))
        };
      });
    }
  },

  async save(tx, device) {
    const thermostat = new DbDeviceThermostat({
      deviceId: device.id,
      temperatureGoal: toNullableNumber(device.temperatureGoal) ?? 20
    });
    await tx.execute(SQL_UPSERT_THERMOSTAT, [thermostat.deviceId, thermostat.temperatureGoal]);

    await tx.execute(SQL_DELETE_THERMOSTAT_SCHEDULES, [device.id]);
    const schedules = asRecordArray(device.temperatureSchedule);
    for (const [scheduleIndex, entry] of schedules.entries()) {
      const schedule = new DbDeviceThermostatSchedule({
        deviceId: device.id,
        scheduleIndex,
        ruleName: toNullableString(entry.rulename) ?? "",
        isActive: toNullableBoolean(entry.active) ?? false
      });
      await tx.execute(SQL_INSERT_THERMOSTAT_SCHEDULE, [
        schedule.deviceId,
        schedule.scheduleIndex,
        schedule.ruleName,
        schedule.isActive
      ]);

      for (const [timeIndex, range] of asRecordArray(entry.rulevalue).entries()) {
        const time = new DbDeviceThermostatScheduleTime({
          deviceId: device.id,
          scheduleIndex,
          timeIndex,
          weekday: toNullableNumber(range.weekday) ?? 0,
          timeOfDay: toNullableString(range.time) ?? "",
          temperature: toNullableNumber(range.temperature) ?? 0
        });
        await tx.execute(SQL_INSERT_THERMOSTAT_SCHEDULE_TIME, [
          time.deviceId,
          time.scheduleIndex,
          time.timeIndex,
          time.weekday,
          time.timeOfDay,
          time.temperature
        ]);
      }
    }
  }
};
