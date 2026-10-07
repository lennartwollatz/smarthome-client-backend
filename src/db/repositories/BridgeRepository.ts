import type { RowDataPacket } from "mysql2/promise";
import { DbHueBridge } from "../../model/db/DbHueBridge.js";
import { DbHueBridgeDevice } from "../../model/db/DbHueBridgeDevice.js";
import type { ModuleBridgeDiscovered } from "../../modules/moduleBridgeDiscovered.js";
import type { DatabaseManager } from "../database.js";
import { fromNullable, toBoolean, toNumberParam, toPlainObject, toStringParam } from "../sqlValues.js";

/** Bridge-Typen mit eigener Tabelle; derzeit werden nur Hue-Bridges gespeichert (`hue_bridges`). */
const SUPPORTED_BRIDGE_TYPES = new Set(["HueBridgeDiscovered"]);

const SQL_SELECT_HUE_BRIDGES = `
  SELECT
      hb.id,
      hb.name,
      hb.address,
      hb.port,
      hb.is_paired  AS isPaired,
      hb.model_id   AS modelId,
      hb.sw_version AS swVersion,
      hb.username,
      hb.client_key AS clientKey
  FROM hue_bridges AS hb`;

const SQL_SELECT_ALL_HUE_BRIDGES = `${SQL_SELECT_HUE_BRIDGES}
  ORDER BY hb.name`;

const SQL_SELECT_HUE_BRIDGE_BY_ID = `${SQL_SELECT_HUE_BRIDGES}
  WHERE hb.id = ?`;

const SQL_SELECT_HUE_BRIDGE_DEVICES = `
  SELECT
      hbd.hue_bridge_id AS hueBridgeId,
      hbd.device_id     AS deviceId,
      hbd.sort_index    AS sortIndex
  FROM hue_bridge_devices AS hbd`;

const SQL_SELECT_ALL_HUE_BRIDGE_DEVICES = `${SQL_SELECT_HUE_BRIDGE_DEVICES}
  ORDER BY hbd.hue_bridge_id, hbd.sort_index`;

const SQL_SELECT_HUE_BRIDGE_DEVICES_BY_BRIDGE = `${SQL_SELECT_HUE_BRIDGE_DEVICES}
  WHERE hbd.hue_bridge_id = ?
  ORDER BY hbd.sort_index`;

const SQL_UPSERT_HUE_BRIDGE = `
  INSERT INTO hue_bridges (id, name, address, port, is_paired, model_id, sw_version, username, client_key)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      name       = incoming.name,
      address    = incoming.address,
      port       = incoming.port,
      is_paired  = incoming.is_paired,
      model_id   = incoming.model_id,
      sw_version = incoming.sw_version,
      username   = incoming.username,
      client_key = incoming.client_key`;

const SQL_DELETE_HUE_BRIDGE_DEVICES = `
  DELETE FROM hue_bridge_devices
  WHERE hue_bridge_id = ?`;

const SQL_INSERT_HUE_BRIDGE_DEVICE = `
  INSERT INTO hue_bridge_devices (hue_bridge_id, device_id, sort_index)
  VALUES (?, ?, ?)`;

/** Geräte-Zuordnungen werden per ON DELETE CASCADE entfernt. */
const SQL_DELETE_HUE_BRIDGE = `
  DELETE FROM hue_bridges
  WHERE id = ?`;

/** Bridges eines Typs (z. B. HueBridgeDiscovered); jeder Typ hat eine eigene Tabelle. */
export class BridgeRepository<B extends ModuleBridgeDiscovered> {
  constructor(
    private readonly db: DatabaseManager,
    bridgeType: string
  ) {
    if (!SUPPORTED_BRIDGE_TYPES.has(bridgeType)) {
      throw new Error(`Unbekannter Bridge-Typ: ${bridgeType}`);
    }
  }

  async findAll(): Promise<B[]> {
    const [bridgeRows, deviceRows] = await Promise.all([
      this.db.query<RowDataPacket>(SQL_SELECT_ALL_HUE_BRIDGES),
      this.db.query<RowDataPacket>(SQL_SELECT_ALL_HUE_BRIDGE_DEVICES)
    ]);

    const deviceIdsByBridge = new Map<string, string[]>();
    for (const bridgeDevice of deviceRows.map(toDbHueBridgeDevice)) {
      const deviceIds = deviceIdsByBridge.get(bridgeDevice.hueBridgeId) ?? [];
      deviceIds.push(bridgeDevice.deviceId);
      deviceIdsByBridge.set(bridgeDevice.hueBridgeId, deviceIds);
    }

    return bridgeRows.map(row => {
      const dbBridge = toDbHueBridge(row);
      return toBridge<B>(dbBridge, deviceIdsByBridge.get(dbBridge.id) ?? []);
    });
  }

  async findById(id: string): Promise<B | null> {
    const [row] = await this.db.query<RowDataPacket>(SQL_SELECT_HUE_BRIDGE_BY_ID, [id]);
    if (!row) return null;
    const deviceRows = await this.db.query<RowDataPacket>(SQL_SELECT_HUE_BRIDGE_DEVICES_BY_BRIDGE, [id]);
    return toBridge<B>(
      toDbHueBridge(row),
      deviceRows.map(deviceRow => toDbHueBridgeDevice(deviceRow).deviceId)
    );
  }

  async save(bridge: B): Promise<void> {
    const plain = toPlainObject(bridge);
    const dbBridge = new DbHueBridge({
      id: bridge.id,
      name: toStringParam(plain.name),
      address: toStringParam(plain.address),
      port: toNumberParam(plain.port),
      isPaired: toBoolean(plain.isPaired),
      modelId: toTextParam(plain.modelId),
      swVersion: toTextParam(plain.swVersion),
      username: toTextParam(plain.username),
      clientKey: toTextParam(plain.clientKey)
    });
    const dbBridgeDevices = toDeviceIds(plain.devices).map(
      (deviceId, sortIndex) => new DbHueBridgeDevice({ hueBridgeId: dbBridge.id, deviceId, sortIndex })
    );

    await this.db.transaction(async tx => {
      await tx.execute(SQL_UPSERT_HUE_BRIDGE, [
        dbBridge.id,
        dbBridge.name,
        dbBridge.address,
        dbBridge.port,
        dbBridge.isPaired,
        dbBridge.modelId,
        dbBridge.swVersion,
        dbBridge.username,
        dbBridge.clientKey
      ]);
      await tx.execute(SQL_DELETE_HUE_BRIDGE_DEVICES, [dbBridge.id]);
      for (const bridgeDevice of dbBridgeDevices) {
        await tx.execute(SQL_INSERT_HUE_BRIDGE_DEVICE, [
          bridgeDevice.hueBridgeId,
          bridgeDevice.deviceId,
          bridgeDevice.sortIndex
        ]);
      }
    });
  }

  async deleteById(id: string): Promise<boolean> {
    return (await this.db.execute(SQL_DELETE_HUE_BRIDGE, [id])) > 0;
  }
}

/** Wie `toStringParam`, behält aber leere Strings. */
function toTextParam(value: unknown): string | null {
  return value === undefined || value === null ? null : String(value);
}

/** Eindeutige, nicht leere Geräte-IDs in Listenreihenfolge. */
function toDeviceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const deviceIds = value
    .map(deviceId => toStringParam(deviceId))
    .filter((deviceId): deviceId is string => deviceId !== null);
  return [...new Set(deviceIds)];
}

function toDbHueBridge(row: RowDataPacket): DbHueBridge {
  return new DbHueBridge({
    id: row.id,
    name: row.name,
    address: row.address,
    port: row.port,
    isPaired: toBoolean(row.isPaired),
    modelId: row.modelId,
    swVersion: row.swVersion,
    username: row.username,
    clientKey: row.clientKey
  });
}

function toDbHueBridgeDevice(row: RowDataPacket): DbHueBridgeDevice {
  return new DbHueBridgeDevice({
    hueBridgeId: row.hueBridgeId,
    deviceId: row.deviceId,
    sortIndex: row.sortIndex
  });
}

/** Liefert ein einfaches Objekt mit den Feldern der Bridge-Klasse (ohne Methoden). */
function toBridge<B>(dbBridge: DbHueBridge, deviceIds: string[]): B {
  return {
    id: dbBridge.id,
    name: dbBridge.name ?? "",
    address: dbBridge.address ?? "",
    port: fromNullable(dbBridge.port),
    isPaired: dbBridge.isPaired,
    devices: deviceIds,
    modelId: fromNullable(dbBridge.modelId),
    swVersion: fromNullable(dbBridge.swVersion),
    username: fromNullable(dbBridge.username),
    clientKey: fromNullable(dbBridge.clientKey)
  } as unknown as B;
}
