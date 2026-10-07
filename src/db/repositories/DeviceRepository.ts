import type { RowDataPacket } from "mysql2/promise";
import type { Device } from "../../model/devices/Device.js";
import { DbDevice } from "../../model/db/DbDevice.js";
import type { DatabaseManager } from "../database.js";
import { toPlainObject } from "../sqlValues.js";
import { calendarTables } from "./devices/calendarTables.js";
import { carTables } from "./devices/carTables.js";
import {
  toNullableBoolean,
  toNullableNumber,
  toNullableString,
  type DeviceTableGroup,
  type PlainDevice
} from "./devices/deviceTableGroup.js";
import { fanTables, lightTables } from "./devices/lightTables.js";
import {
  heosDetailTables,
  hueDetailTables,
  lgDetailTables,
  matterDetailTables,
  sonosDetailTables,
  voiceAssistantDetailTables,
  wacDetailTables,
  xiaomiDetailTables
} from "./devices/moduleDetailTables.js";
import { presenceTables } from "./devices/presenceTables.js";
import {
  lightLevelSensorTables,
  motionSensorTables,
  temperatureSensorTables,
  thermostatTables
} from "./devices/sensorTables.js";
import { speakerTables } from "./devices/speakerTables.js";
import { buttonTables, energyTables } from "./devices/switchTables.js";
import { tvTables } from "./devices/tvTables.js";
import { vacuumTables } from "./devices/vacuumTables.js";
import { weatherTables } from "./devices/weatherTables.js";

const SQL_SELECT_DEVICES = `
  SELECT
      d.id,
      d.name,
      d.icon,
      d.type_label      AS typeLabel,
      d.room_id         AS roomId,
      d.device_type     AS deviceType,
      d.module_id       AS moduleId,
      d.is_connected    AS isConnected,
      d.is_pairing_mode AS isPairingMode,
      d.has_battery     AS hasBattery,
      d.battery_level   AS batteryLevel,
      d.quick_access    AS quickAccess
  FROM devices AS d`;

const SQL_SELECT_ALL_DEVICES = `${SQL_SELECT_DEVICES}
  ORDER BY d.created_at`;

const SQL_SELECT_DEVICE_BY_ID = `${SQL_SELECT_DEVICES}
  WHERE d.id = ?`;

/** Unbekannte Raum-IDs werden über die Unterabfrage zu NULL, statt am Fremdschlüssel zu scheitern. */
const SQL_UPSERT_DEVICE = `
  INSERT INTO devices (
      id, name, icon, type_label, room_id, device_type, module_id,
      is_connected, is_pairing_mode, has_battery, battery_level, quick_access
  )
  VALUES (
      ?, ?, ?, ?, (SELECT r.id FROM rooms AS r WHERE r.id = ?), ?, ?,
      ?, ?, ?, ?, ?
  ) AS incoming
  ON DUPLICATE KEY UPDATE
      name            = incoming.name,
      icon            = incoming.icon,
      type_label      = incoming.type_label,
      room_id         = incoming.room_id,
      device_type     = incoming.device_type,
      module_id       = incoming.module_id,
      is_connected    = incoming.is_connected,
      is_pairing_mode = incoming.is_pairing_mode,
      has_battery     = incoming.has_battery,
      battery_level   = incoming.battery_level,
      quick_access    = incoming.quick_access`;

/** Löscht über ON DELETE CASCADE alle Fähigkeits-, Listen- und Detailzeilen des Geräts. */
const SQL_DELETE_DEVICE = `
  DELETE FROM devices
  WHERE id = ?`;

/** Reihenfolge ist egal; jede Gruppe entscheidet anhand von Gerätetyp bzw. Modul, ob sie zuständig ist. */
const DEVICE_TABLE_GROUPS: readonly DeviceTableGroup[] = [
  lightTables,
  fanTables,
  buttonTables,
  energyTables,
  motionSensorTables,
  lightLevelSensorTables,
  temperatureSensorTables,
  thermostatTables,
  speakerTables,
  tvTables,
  vacuumTables,
  carTables,
  weatherTables,
  presenceTables,
  calendarTables,
  hueDetailTables,
  matterDetailTables,
  xiaomiDetailTables,
  lgDetailTables,
  sonosDetailTables,
  heosDetailTables,
  wacDetailTables,
  voiceAssistantDetailTables
];

/** Liefert Geräte als flache Objekte; die Modul-Manager wandeln sie in ihre Geräteklassen um. */
export class DeviceRepository {
  constructor(private readonly db: DatabaseManager) {}

  async findAll(): Promise<Device[]> {
    const rows = await this.db.query<RowDataPacket>(SQL_SELECT_ALL_DEVICES);
    return this.loadDevices(rows);
  }

  async findById(id: string): Promise<Device | null> {
    const rows = await this.db.query<RowDataPacket>(SQL_SELECT_DEVICE_BY_ID, [id]);
    const [device] = await this.loadDevices(rows);
    return device ?? null;
  }

  async save(device: Device): Promise<void> {
    const plain = toPlainObject(device) as PlainDevice;
    const dbDevice = toDbDevice(device.id, plain);
    await this.db.transaction(async tx => {
      await tx.execute(SQL_UPSERT_DEVICE, [
        dbDevice.id,
        dbDevice.name,
        dbDevice.icon,
        dbDevice.typeLabel,
        dbDevice.roomId,
        dbDevice.deviceType,
        dbDevice.moduleId,
        dbDevice.isConnected,
        dbDevice.isPairingMode,
        dbDevice.hasBattery,
        dbDevice.batteryLevel,
        dbDevice.quickAccess
      ]);
      for (const group of DEVICE_TABLE_GROUPS) {
        if (group.appliesTo(plain)) await group.save(tx, plain);
      }
    });
  }

  async deleteById(id: string): Promise<boolean> {
    return (await this.db.execute(SQL_DELETE_DEVICE, [id])) > 0;
  }

  /** Lädt die Gerätezeilen und ergänzt sie aus allen Fähigkeits- und Detailtabellen. */
  private async loadDevices(rows: RowDataPacket[]): Promise<Device[]> {
    const devices = new Map<string, PlainDevice>();
    for (const row of rows) {
      const dbDevice = new DbDevice({
        id: row.id,
        name: row.name,
        icon: row.icon,
        typeLabel: row.typeLabel,
        roomId: row.roomId,
        deviceType: row.deviceType,
        moduleId: row.moduleId,
        isConnected: toNullableBoolean(row.isConnected) ?? false,
        isPairingMode: toNullableBoolean(row.isPairingMode) ?? false,
        hasBattery: toNullableBoolean(row.hasBattery) ?? false,
        batteryLevel: Number(row.batteryLevel),
        quickAccess: toNullableBoolean(row.quickAccess) ?? false
      });
      devices.set(dbDevice.id, toPlainDevice(dbDevice));
    }
    if (devices.size === 0) return [];

    for (const group of DEVICE_TABLE_GROUPS) {
      await group.load(this.db, devices);
    }
    return [...devices.values()] as unknown as Device[];
  }
}

function toDbDevice(id: string, plain: PlainDevice): DbDevice {
  return new DbDevice({
    id,
    name: toNullableString(plain.name),
    icon: toNullableString(plain.icon),
    typeLabel: toNullableString(plain.typeLabel),
    roomId: toNullableString(plain.room),
    deviceType: toNullableString(plain.type),
    moduleId: toNullableString(plain.moduleId),
    isConnected: toNullableBoolean(plain.isConnected) ?? false,
    isPairingMode: toNullableBoolean(plain.isPairingMode) ?? false,
    hasBattery: toNullableBoolean(plain.hasBattery) ?? false,
    batteryLevel: toNullableNumber(plain.batteryLevel) ?? 0,
    quickAccess: toNullableBoolean(plain.quickAccess) ?? false
  });
}

function toPlainDevice(dbDevice: DbDevice): PlainDevice {
  const plain: PlainDevice = {
    id: dbDevice.id,
    isConnected: dbDevice.isConnected,
    isPairingMode: dbDevice.isPairingMode,
    hasBattery: dbDevice.hasBattery,
    batteryLevel: dbDevice.batteryLevel,
    quickAccess: dbDevice.quickAccess
  };
  if (dbDevice.name !== null) plain.name = dbDevice.name;
  if (dbDevice.icon !== null) plain.icon = dbDevice.icon;
  if (dbDevice.typeLabel !== null) plain.typeLabel = dbDevice.typeLabel;
  if (dbDevice.roomId !== null) plain.room = dbDevice.roomId;
  if (dbDevice.deviceType !== null) plain.type = dbDevice.deviceType;
  if (dbDevice.moduleId !== null) plain.moduleId = dbDevice.moduleId;
  return plain;
}
