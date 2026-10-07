import type { RowDataPacket } from "mysql2/promise";
import { DeviceType } from "../../../model/devices/helper/DeviceType.js";
import { DbDeviceCar } from "../../../model/db/DbDeviceCar.js";
import { DbDeviceCarDoors } from "../../../model/db/DbDeviceCarDoors.js";
import { DbDeviceCarLocation } from "../../../model/db/DbDeviceCarLocation.js";
import { DbDeviceCarWindows } from "../../../model/db/DbDeviceCarWindows.js";
import type { SqlExecutor } from "../../database.js";
import {
  assignIfSet,
  isRecord,
  toNullableBoolean,
  toNullableNumber,
  toNullableString,
  type DeviceTableGroup
} from "./deviceTableGroup.js";

const SQL_SELECT_CARS = `
  SELECT
      c.device_id             AS deviceId,
      c.vin,
      c.fuel_level_percent    AS fuelLevelPercent,
      c.range_km              AS rangeKm,
      c.mileage_km            AS mileageKm,
      c.is_locked             AS isLocked,
      c.is_in_use             AS isInUse,
      c.is_climate_control_on AS isClimateControlOn
  FROM device_cars AS c`;

const SQL_UPSERT_CAR = `
  INSERT INTO device_cars (
      device_id, vin, fuel_level_percent, range_km, mileage_km, is_locked, is_in_use, is_climate_control_on
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      vin                   = incoming.vin,
      fuel_level_percent    = incoming.fuel_level_percent,
      range_km              = incoming.range_km,
      mileage_km            = incoming.mileage_km,
      is_locked             = incoming.is_locked,
      is_in_use             = incoming.is_in_use,
      is_climate_control_on = incoming.is_climate_control_on`;

const SQL_SELECT_LOCATIONS = `
  SELECT
      l.device_id AS deviceId,
      l.name,
      l.latitude,
      l.longitude
  FROM device_car_locations AS l`;

const SQL_UPSERT_LOCATION = `
  INSERT INTO device_car_locations (device_id, name, latitude, longitude)
  VALUES (?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      name      = incoming.name,
      latitude  = incoming.latitude,
      longitude = incoming.longitude`;

const SQL_DELETE_LOCATION = `
  DELETE FROM device_car_locations
  WHERE device_id = ?`;

const SQL_SELECT_WINDOWS = `
  SELECT
      w.device_id      AS deviceId,
      w.left_front     AS leftFront,
      w.left_rear      AS leftRear,
      w.right_front    AS rightFront,
      w.right_rear     AS rightRear,
      w.combined_state AS combinedState
  FROM device_car_windows AS w`;

const SQL_UPSERT_WINDOWS = `
  INSERT INTO device_car_windows (device_id, left_front, left_rear, right_front, right_rear, combined_state)
  VALUES (?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      left_front     = incoming.left_front,
      left_rear      = incoming.left_rear,
      right_front    = incoming.right_front,
      right_rear     = incoming.right_rear,
      combined_state = incoming.combined_state`;

const SQL_DELETE_WINDOWS = `
  DELETE FROM device_car_windows
  WHERE device_id = ?`;

const SQL_SELECT_DOORS = `
  SELECT
      d.device_id               AS deviceId,
      d.combined_security_state AS combinedSecurityState,
      d.left_front              AS leftFront,
      d.left_rear               AS leftRear,
      d.right_front             AS rightFront,
      d.right_rear              AS rightRear,
      d.combined_state          AS combinedState,
      d.hood,
      d.trunk
  FROM device_car_doors AS d`;

const SQL_UPSERT_DOORS = `
  INSERT INTO device_car_doors (
      device_id, combined_security_state, left_front, left_rear, right_front, right_rear, combined_state, hood, trunk
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      combined_security_state = incoming.combined_security_state,
      left_front              = incoming.left_front,
      left_rear               = incoming.left_rear,
      right_front             = incoming.right_front,
      right_rear              = incoming.right_rear,
      combined_state          = incoming.combined_state,
      hood                    = incoming.hood,
      trunk                   = incoming.trunk`;

const SQL_DELETE_DOORS = `
  DELETE FROM device_car_doors
  WHERE device_id = ?`;

const flag = (value: unknown): boolean => toNullableBoolean(value) ?? false;

/** Fahrzeuge; Standort, Fenster und Türen sind optional und liegen in eigenen 1:1-Tabellen. */
export const carTables: DeviceTableGroup = {
  appliesTo: device => device.type === DeviceType.CAR,

  async load(db, devices) {
    for (const row of await db.query<RowDataPacket>(SQL_SELECT_CARS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const car = new DbDeviceCar({
        deviceId: row.deviceId,
        vin: row.vin,
        fuelLevelPercent: toNullableNumber(row.fuelLevelPercent),
        rangeKm: toNullableNumber(row.rangeKm),
        mileageKm: toNullableNumber(row.mileageKm),
        isLocked: toNullableBoolean(row.isLocked),
        isInUse: toNullableBoolean(row.isInUse),
        isClimateControlOn: toNullableBoolean(row.isClimateControlOn)
      });
      assignIfSet(device, "vin", car.vin);
      assignIfSet(device, "fuelLevelPercent", car.fuelLevelPercent);
      assignIfSet(device, "rangeKm", car.rangeKm);
      assignIfSet(device, "mileageKm", car.mileageKm);
      assignIfSet(device, "lockedState", car.isLocked);
      assignIfSet(device, "inUseState", car.isInUse);
      assignIfSet(device, "climateControlState", car.isClimateControlOn);
    }

    for (const row of await db.query<RowDataPacket>(SQL_SELECT_LOCATIONS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const location = new DbDeviceCarLocation({
        deviceId: row.deviceId,
        name: row.name,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude)
      });
      device.location = {
        name: location.name,
        coordinates: { latitude: location.latitude, longitude: location.longitude }
      };
    }

    for (const row of await db.query<RowDataPacket>(SQL_SELECT_WINDOWS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const windows = new DbDeviceCarWindows({
        deviceId: row.deviceId,
        leftFront: flag(row.leftFront),
        leftRear: flag(row.leftRear),
        rightFront: flag(row.rightFront),
        rightRear: flag(row.rightRear),
        combinedState: flag(row.combinedState)
      });
      device.windows = {
        leftFront: windows.leftFront,
        leftRear: windows.leftRear,
        rightFront: windows.rightFront,
        rightRear: windows.rightRear,
        combinedState: windows.combinedState
      };
    }

    for (const row of await db.query<RowDataPacket>(SQL_SELECT_DOORS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const doors = new DbDeviceCarDoors({
        deviceId: row.deviceId,
        combinedSecurityState: flag(row.combinedSecurityState),
        leftFront: flag(row.leftFront),
        leftRear: flag(row.leftRear),
        rightFront: flag(row.rightFront),
        rightRear: flag(row.rightRear),
        combinedState: flag(row.combinedState),
        hood: flag(row.hood),
        trunk: flag(row.trunk)
      });
      device.doors = {
        combinedSecurityState: doors.combinedSecurityState,
        leftFront: doors.leftFront,
        leftRear: doors.leftRear,
        rightFront: doors.rightFront,
        rightRear: doors.rightRear,
        combinedState: doors.combinedState,
        hood: doors.hood,
        trunk: doors.trunk
      };
    }
  },

  async save(tx, device) {
    const car = new DbDeviceCar({
      deviceId: device.id,
      vin: toNullableString(device.vin),
      fuelLevelPercent: toNullableNumber(device.fuelLevelPercent),
      rangeKm: toNullableNumber(device.rangeKm),
      mileageKm: toNullableNumber(device.mileageKm),
      isLocked: toNullableBoolean(device.lockedState),
      isInUse: toNullableBoolean(device.inUseState),
      isClimateControlOn: toNullableBoolean(device.climateControlState)
    });
    await tx.execute(SQL_UPSERT_CAR, [
      car.deviceId,
      car.vin,
      car.fuelLevelPercent,
      car.rangeKm,
      car.mileageKm,
      car.isLocked,
      car.isInUse,
      car.isClimateControlOn
    ]);

    await saveLocation(tx, device.id, device.location);
    await saveWindows(tx, device.id, device.windows);
    await saveDoors(tx, device.id, device.doors);
  }
};

async function saveLocation(tx: SqlExecutor, deviceId: string, value: unknown): Promise<void> {
  const coordinates = isRecord(value) && isRecord(value.coordinates) ? value.coordinates : null;
  const latitude = toNullableNumber(coordinates?.latitude);
  const longitude = toNullableNumber(coordinates?.longitude);
  if (!isRecord(value) || latitude === null || longitude === null) {
    await tx.execute(SQL_DELETE_LOCATION, [deviceId]);
    return;
  }
  const location = new DbDeviceCarLocation({
    deviceId,
    name: toNullableString(value.name) ?? "",
    latitude,
    longitude
  });
  await tx.execute(SQL_UPSERT_LOCATION, [location.deviceId, location.name, location.latitude, location.longitude]);
}

async function saveWindows(tx: SqlExecutor, deviceId: string, value: unknown): Promise<void> {
  if (!isRecord(value)) {
    await tx.execute(SQL_DELETE_WINDOWS, [deviceId]);
    return;
  }
  const windows = new DbDeviceCarWindows({
    deviceId,
    leftFront: flag(value.leftFront),
    leftRear: flag(value.leftRear),
    rightFront: flag(value.rightFront),
    rightRear: flag(value.rightRear),
    combinedState: flag(value.combinedState)
  });
  await tx.execute(SQL_UPSERT_WINDOWS, [
    windows.deviceId,
    windows.leftFront,
    windows.leftRear,
    windows.rightFront,
    windows.rightRear,
    windows.combinedState
  ]);
}

async function saveDoors(tx: SqlExecutor, deviceId: string, value: unknown): Promise<void> {
  if (!isRecord(value)) {
    await tx.execute(SQL_DELETE_DOORS, [deviceId]);
    return;
  }
  const doors = new DbDeviceCarDoors({
    deviceId,
    combinedSecurityState: flag(value.combinedSecurityState),
    leftFront: flag(value.leftFront),
    leftRear: flag(value.leftRear),
    rightFront: flag(value.rightFront),
    rightRear: flag(value.rightRear),
    combinedState: flag(value.combinedState),
    hood: flag(value.hood),
    trunk: flag(value.trunk)
  });
  await tx.execute(SQL_UPSERT_DOORS, [
    doors.deviceId,
    doors.combinedSecurityState,
    doors.leftFront,
    doors.leftRear,
    doors.rightFront,
    doors.rightRear,
    doors.combinedState,
    doors.hood,
    doors.trunk
  ]);
}
