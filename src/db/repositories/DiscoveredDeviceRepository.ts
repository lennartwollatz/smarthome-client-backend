import type { RowDataPacket } from "mysql2/promise";
import { DbAppleCalendarDiscoveredDevice } from "../../model/db/DbAppleCalendarDiscoveredDevice.js";
import { DbBmwDiscoveredDevice } from "../../model/db/DbBmwDiscoveredDevice.js";
import { DbCalendarDiscoveredDevice } from "../../model/db/DbCalendarDiscoveredDevice.js";
import { DbHeosDiscoveredDevice } from "../../model/db/DbHeosDiscoveredDevice.js";
import { DbHueDiscoveredDevice } from "../../model/db/DbHueDiscoveredDevice.js";
import { DbLgDiscoveredDevice } from "../../model/db/DbLgDiscoveredDevice.js";
import { DbMatterDiscoveredDevice } from "../../model/db/DbMatterDiscoveredDevice.js";
import { DbMatterDiscoveredDeviceTxtRecord } from "../../model/db/DbMatterDiscoveredDeviceTxtRecord.js";
import { DbSonosDiscoveredDevice } from "../../model/db/DbSonosDiscoveredDevice.js";
import { DbWacLightingDiscoveredDevice } from "../../model/db/DbWacLightingDiscoveredDevice.js";
import { DbWeatherDiscoveredDevice } from "../../model/db/DbWeatherDiscoveredDevice.js";
import { DbXiaomiDiscoveredDevice } from "../../model/db/DbXiaomiDiscoveredDevice.js";
import type { DatabaseManager, SqlParam } from "../database.js";
import {
  fromNullable,
  placeholders,
  toBoolean,
  toNumberParam,
  toPlainObject,
  toStringParam
} from "../sqlValues.js";

/** Gemeinsame Spalten aller Tabellen `<modul>_discovered_devices`. */
type DbDiscoveredDevice = {
  readonly id: string;
  readonly name: string | null;
  readonly address: string | null;
  readonly port: number | null;
};

type DbColumnValue = string | number | boolean | Date | null;

/**
 * text: VARCHAR, number: Zahl, flag: BOOLEAN NOT NULL, boolean: BOOLEAN NULL (NULL = unbekannt),
 * epochMillis: DATETIME(3), im Gerät als Millisekunden seit 1970.
 */
type ColumnKind = "text" | "number" | "flag" | "boolean" | "epochMillis";

type DiscoveredDeviceColumn = {
  readonly column: string;
  /** Feld im DB-Modell und im Gerät. */
  readonly property: string;
  readonly kind: ColumnKind;
};

type DiscoveredDeviceTable = {
  readonly columns: readonly DiscoveredDeviceColumn[];
  /** Gerätefelder, die immer der ID entsprechen und daher nicht gespeichert werden. */
  readonly idAliases: readonly string[];
  readonly hasTxtRecords: boolean;
  readonly create: (fields: Record<string, DbColumnValue>) => DbDiscoveredDevice;
  readonly sql: {
    readonly selectAll: string;
    readonly selectById: string;
    readonly upsert: string;
    readonly deleteById: string;
    readonly deleteAll: string;
  };
};

const BASE_COLUMNS: readonly DiscoveredDeviceColumn[] = [
  { column: "id", property: "id", kind: "text" },
  { column: "name", property: "name", kind: "text" },
  { column: "address", property: "address", kind: "text" },
  { column: "port", property: "port", kind: "number" }
];

function defineTable<T extends DbDiscoveredDevice>(
  model: new (fields: T) => T,
  table: string,
  columns: readonly {
    readonly column: string;
    readonly property: Exclude<keyof T, keyof DbDiscoveredDevice> & string;
    readonly kind: ColumnKind;
  }[],
  options: { idAliases?: readonly string[]; hasTxtRecords?: boolean } = {}
): DiscoveredDeviceTable {
  const allColumns = [...BASE_COLUMNS, ...columns];
  const select = `
  SELECT
      ${allColumns.map(c => `d.${c.column} AS ${c.property}`).join(",\n      ")}
  FROM ${table} AS d`;
  const deleteAll = `
  DELETE FROM ${table}`;

  return {
    columns,
    idAliases: options.idAliases ?? [],
    hasTxtRecords: options.hasTxtRecords ?? false,
    create: fields => new model(fields as unknown as T),
    sql: {
      selectAll: `${select}
  ORDER BY d.name`,
      selectById: `${select}
  WHERE d.id = ?`,
      upsert: `
  INSERT INTO ${table} (${allColumns.map(c => c.column).join(", ")})
  VALUES (${allColumns.map(() => "?").join(", ")}) AS incoming
  ON DUPLICATE KEY UPDATE
      ${allColumns
        .filter(c => c.column !== "id")
        .map(c => `${c.column} = incoming.${c.column}`)
        .join(",\n      ")}`,
      deleteById: `${deleteAll}
  WHERE id = ?`,
      deleteAll
    }
  };
}

/** Discovery-Typ (getDiscoveredDeviceTypeName) → Tabelle `<modul>_discovered_devices`. */
const DISCOVERED_DEVICE_TABLES = new Map<string, DiscoveredDeviceTable>([
  [
    "MatterDeviceDiscovered",
    defineTable(
      DbMatterDiscoveredDevice,
      "matter_discovered_devices",
      [
        { column: "vendor_id", property: "vendorId", kind: "number" },
        { column: "product_id", property: "productId", kind: "number" },
        { column: "discriminator", property: "discriminator", kind: "number" },
        { column: "device_type", property: "deviceType", kind: "number" },
        { column: "instance_name", property: "instanceName", kind: "text" },
        { column: "pairing_hint", property: "pairingHint", kind: "text" },
        { column: "pairing_instruction", property: "pairingInstruction", kind: "text" },
        { column: "rotating_id", property: "rotatingId", kind: "text" },
        { column: "is_commissionable", property: "isCommissionable", kind: "flag" },
        { column: "is_operational", property: "isOperational", kind: "flag" },
        { column: "last_seen_at", property: "lastSeenAt", kind: "epochMillis" },
        { column: "session_idle_interval", property: "sessionIdleInterval", kind: "number" },
        { column: "session_active_interval", property: "sessionActiveInterval", kind: "number" },
        { column: "session_active_threshold", property: "sessionActiveThreshold", kind: "number" },
        { column: "tcp_supported", property: "tcpSupported", kind: "boolean" },
        { column: "compressed_fabric_id", property: "compressedFabricId", kind: "text" },
        { column: "operational_node_id", property: "operationalNodeId", kind: "text" },
        { column: "node_id", property: "nodeId", kind: "text" },
        { column: "node_fabric_id", property: "nodeFabricId", kind: "text" },
        { column: "token", property: "token", kind: "text" },
        { column: "paired_at", property: "pairedAt", kind: "epochMillis" },
        { column: "is_paired", property: "isPaired", kind: "flag" }
      ],
      { hasTxtRecords: true }
    )
  ],
  [
    "HeosDeviceDiscovered",
    defineTable(
      DbHeosDiscoveredDevice,
      "heos_discovered_devices",
      [
        { column: "friendly_name", property: "friendlyName", kind: "text" },
        { column: "model_name", property: "modelName", kind: "text" },
        { column: "model_number", property: "modelNumber", kind: "text" },
        { column: "heos_device_id", property: "deviceId", kind: "text" },
        { column: "wlan_mac", property: "wlanMac", kind: "text" },
        { column: "ipv4_address", property: "ipv4Address", kind: "text" },
        { column: "ipv6_address", property: "ipv6Address", kind: "text" },
        { column: "mdns_name", property: "mdnsName", kind: "text" },
        { column: "firmware_version", property: "firmwareVersion", kind: "text" },
        { column: "serial_number", property: "serialNumber", kind: "text" },
        { column: "manufacturer", property: "manufacturer", kind: "text" },
        { column: "ip_address", property: "ipAddress", kind: "text" },
        { column: "pid", property: "pid", kind: "number" }
      ],
      { idAliases: ["udn"] }
    )
  ],
  [
    "SonosDeviceDiscovered",
    defineTable(
      DbSonosDiscoveredDevice,
      "sonos_discovered_devices",
      [
        { column: "model_name", property: "modelName", kind: "text" },
        { column: "model_number", property: "modelNumber", kind: "text" },
        { column: "wlan_mac", property: "wlanMac", kind: "text" },
        { column: "serial_number", property: "serialNumber", kind: "text" }
      ],
      { idAliases: ["udn"] }
    )
  ],
  [
    "LGDeviceDiscovered",
    defineTable(DbLgDiscoveredDevice, "lg_discovered_devices", [
      { column: "service_type", property: "serviceType", kind: "text" },
      { column: "manufacturer", property: "manufacturer", kind: "text" },
      { column: "integrator", property: "integrator", kind: "text" },
      { column: "mac_address", property: "macAddress", kind: "text" }
    ])
  ],
  [
    "XiaomiDeviceDiscovered",
    defineTable(DbXiaomiDiscoveredDevice, "xiaomi_discovered_devices", [
      { column: "model", property: "model", kind: "text" },
      { column: "token", property: "token", kind: "text" },
      { column: "mac", property: "mac", kind: "text" },
      { column: "did", property: "did", kind: "text" },
      { column: "locale", property: "locale", kind: "text" },
      { column: "status", property: "status", kind: "text" }
    ])
  ],
  [
    "WACLightingDeviceDiscovered",
    defineTable(DbWacLightingDiscoveredDevice, "waclighting_discovered_devices", [
      { column: "mac", property: "mac", kind: "text" },
      { column: "model", property: "model", kind: "text" },
      { column: "manufacturer", property: "manufacturer", kind: "text" },
      { column: "client_id", property: "clientId", kind: "text" },
      { column: "fan_installed", property: "fanInstalled", kind: "boolean" },
      { column: "light_installed", property: "lightInstalled", kind: "boolean" },
      { column: "has_fan", property: "hasFan", kind: "boolean" },
      { column: "has_light", property: "hasLight", kind: "boolean" },
      { column: "firmware_version", property: "firmwareVersion", kind: "text" },
      { column: "product_type", property: "productType", kind: "text" }
    ])
  ],
  [
    "BMWDeviceDiscovered",
    defineTable(DbBmwDiscoveredDevice, "bmw_discovered_devices", [
      { column: "vin", property: "vin", kind: "text" },
      { column: "brand", property: "brand", kind: "text" },
      { column: "model", property: "model", kind: "text" }
    ])
  ],
  ["HueDeviceDiscovered", defineTable(DbHueDiscoveredDevice, "hue_discovered_devices", [])],
  [
    "AppleCalendarDeviceDiscovered",
    defineTable(DbAppleCalendarDiscoveredDevice, "apple_calendar_discovered_devices", [])
  ],
  ["CalendarDeviceDiscovered", defineTable(DbCalendarDiscoveredDevice, "calendar_discovered_devices", [])],
  [
    "WeatherDeviceDiscovered",
    defineTable(DbWeatherDiscoveredDevice, "weather_discovered_devices", [
      { column: "latitude", property: "latitude", kind: "number" },
      { column: "longitude", property: "longitude", kind: "number" }
    ])
  ]
]);

const SQL_SELECT_MATTER_TXT_RECORDS = `
  SELECT
      tr.matter_discovered_device_id AS matterDiscoveredDeviceId,
      tr.record_key                  AS recordKey,
      tr.record_value                AS recordValue
  FROM matter_discovered_device_txt_records AS tr`;

const SQL_SELECT_ALL_MATTER_TXT_RECORDS = `${SQL_SELECT_MATTER_TXT_RECORDS}
  ORDER BY tr.matter_discovered_device_id, tr.record_key`;

const SQL_SELECT_MATTER_TXT_RECORDS_BY_DEVICE = `${SQL_SELECT_MATTER_TXT_RECORDS}
  WHERE tr.matter_discovered_device_id = ?
  ORDER BY tr.record_key`;

const SQL_DELETE_MATTER_TXT_RECORDS = `
  DELETE FROM matter_discovered_device_txt_records
  WHERE matter_discovered_device_id = ?`;

const SQL_INSERT_MATTER_TXT_RECORD = `
  INSERT INTO matter_discovered_device_txt_records (matter_discovered_device_id, record_key, record_value)
  VALUES (?, ?, ?)`;

/** Gefundene Geräte eines Typs (z. B. MatterDeviceDiscovered); jeder Typ hat eine eigene Tabelle. */
export class DiscoveredDeviceRepository<D> {
  private readonly table: DiscoveredDeviceTable;

  constructor(
    private readonly db: DatabaseManager,
    discoveryType: string
  ) {
    const table = DISCOVERED_DEVICE_TABLES.get(discoveryType);
    if (!table) {
      throw new Error(`Unbekannter Discovery-Typ: ${discoveryType}`);
    }
    this.table = table;
  }

  async findAll(): Promise<D[]> {
    const [rows, txtRecordRows] = await Promise.all([
      this.db.query<RowDataPacket>(this.table.sql.selectAll),
      this.table.hasTxtRecords
        ? this.db.query<RowDataPacket>(SQL_SELECT_ALL_MATTER_TXT_RECORDS)
        : Promise.resolve([])
    ]);

    const txtRecordsByDevice = new Map<string, DbMatterDiscoveredDeviceTxtRecord[]>();
    for (const txtRecord of txtRecordRows.map(toDbTxtRecord)) {
      const txtRecords = txtRecordsByDevice.get(txtRecord.matterDiscoveredDeviceId) ?? [];
      txtRecords.push(txtRecord);
      txtRecordsByDevice.set(txtRecord.matterDiscoveredDeviceId, txtRecords);
    }

    return rows.map(row => {
      const dbDevice = toDbDiscoveredDevice(this.table, row);
      return toDiscoveredDevice<D>(this.table, dbDevice, txtRecordsByDevice.get(dbDevice.id) ?? []);
    });
  }

  async findById(id: string): Promise<D | null> {
    const [row] = await this.db.query<RowDataPacket>(this.table.sql.selectById, [id]);
    if (!row) return null;
    const txtRecordRows = this.table.hasTxtRecords
      ? await this.db.query<RowDataPacket>(SQL_SELECT_MATTER_TXT_RECORDS_BY_DEVICE, [id])
      : [];
    return toDiscoveredDevice<D>(
      this.table,
      toDbDiscoveredDevice(this.table, row),
      txtRecordRows.map(toDbTxtRecord)
    );
  }

  async save(id: string, device: D): Promise<void> {
    const plain = toPlainObject(device);
    const dbDevice = fromDiscoveredDevice(this.table, id, plain);
    const params = [...BASE_COLUMNS, ...this.table.columns].map(
      c => (dbDevice as unknown as Record<string, DbColumnValue>)[c.property]
    );

    if (!this.table.hasTxtRecords) {
      await this.db.execute(this.table.sql.upsert, params);
      return;
    }

    const dbTxtRecords = toDbTxtRecords(id, plain.txtRecord);
    await this.db.transaction(async tx => {
      await tx.execute(this.table.sql.upsert, params);
      await tx.execute(SQL_DELETE_MATTER_TXT_RECORDS, [id]);
      for (const txtRecord of dbTxtRecords) {
        await tx.execute(SQL_INSERT_MATTER_TXT_RECORD, [
          txtRecord.matterDiscoveredDeviceId,
          txtRecord.recordKey,
          txtRecord.recordValue
        ]);
      }
    });
  }

  /** TXT-Einträge werden per ON DELETE CASCADE entfernt. */
  async deleteById(id: string): Promise<boolean> {
    return (await this.db.execute(this.table.sql.deleteById, [id])) > 0;
  }

  async deleteAllExcept(keepIds: readonly string[]): Promise<number> {
    if (keepIds.length === 0) {
      return this.db.execute(this.table.sql.deleteAll);
    }
    const params: SqlParam[] = [...keepIds];
    return this.db.execute(
      `${this.table.sql.deleteAll}
  WHERE id NOT IN (${placeholders(params)})`,
      params
    );
  }
}

/** Wie `toStringParam`, behält aber leere Strings. */
function toTextParam(value: unknown): string | null {
  return value === undefined || value === null ? null : String(value);
}

function toEpochMillisParam(value: unknown): Date | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value) : null;
}

function toColumnParam(kind: ColumnKind, value: unknown): DbColumnValue {
  switch (kind) {
    case "text":
      return toTextParam(value);
    case "number":
      return toNumberParam(value);
    case "flag":
      return value === true;
    case "boolean":
      return typeof value === "boolean" ? value : null;
    case "epochMillis":
      return toEpochMillisParam(value);
  }
}

function fromRowValue(kind: ColumnKind, value: unknown): DbColumnValue {
  if (kind === "flag") return toBoolean(value);
  if (value === null || value === undefined) return null;
  if (kind === "boolean") return toBoolean(value);
  return value as DbColumnValue;
}

function toDbDiscoveredDevice(table: DiscoveredDeviceTable, row: RowDataPacket): DbDiscoveredDevice {
  const fields: Record<string, DbColumnValue> = {
    id: row.id,
    name: row.name,
    address: row.address,
    port: row.port
  };
  for (const c of table.columns) {
    fields[c.property] = fromRowValue(c.kind, row[c.property]);
  }
  return table.create(fields);
}

function fromDiscoveredDevice(
  table: DiscoveredDeviceTable,
  id: string,
  plain: Record<string, unknown>
): DbDiscoveredDevice {
  const fields: Record<string, DbColumnValue> = {
    id,
    name: toStringParam(plain.name),
    address: toStringParam(plain.address),
    port: toNumberParam(plain.port)
  };
  for (const c of table.columns) {
    fields[c.property] = toColumnParam(c.kind, plain[c.property]);
  }
  return table.create(fields);
}

/** Liefert ein einfaches Objekt mit denselben Feldnamen wie die Discovered-Klasse; NULL-Spalten entfallen. */
function toDiscoveredDevice<D>(
  table: DiscoveredDeviceTable,
  dbDevice: DbDiscoveredDevice,
  txtRecords: DbMatterDiscoveredDeviceTxtRecord[]
): D {
  const values = dbDevice as unknown as Record<string, DbColumnValue>;
  const device: Record<string, unknown> = {
    id: dbDevice.id,
    name: dbDevice.name ?? "",
    address: dbDevice.address ?? "",
    port: fromNullable(dbDevice.port)
  };
  for (const alias of table.idAliases) {
    device[alias] = dbDevice.id;
  }
  for (const c of table.columns) {
    const value = values[c.property];
    if (value === null) continue;
    device[c.property] = c.kind === "epochMillis" && value instanceof Date ? value.getTime() : value;
  }
  if (txtRecords.length > 0) {
    device.txtRecord = Object.fromEntries(txtRecords.map(r => [r.recordKey, r.recordValue]));
  }
  return device as D;
}

function toDbTxtRecord(row: RowDataPacket): DbMatterDiscoveredDeviceTxtRecord {
  return new DbMatterDiscoveredDeviceTxtRecord({
    matterDiscoveredDeviceId: row.matterDiscoveredDeviceId,
    recordKey: row.recordKey,
    recordValue: row.recordValue
  });
}

function toDbTxtRecords(deviceId: string, value: unknown): DbMatterDiscoveredDeviceTxtRecord[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([recordKey, recordValue]) => recordKey !== "" && recordValue !== undefined && recordValue !== null)
    .map(
      ([recordKey, recordValue]) =>
        new DbMatterDiscoveredDeviceTxtRecord({
          matterDiscoveredDeviceId: deviceId,
          recordKey,
          recordValue: String(recordValue)
        })
    );
}
