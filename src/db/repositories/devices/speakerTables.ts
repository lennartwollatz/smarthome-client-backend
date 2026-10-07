import type { RowDataPacket } from "mysql2/promise";
import { DeviceType } from "../../../model/devices/helper/DeviceType.js";
import { DbDeviceSpeaker, type DbPlayState } from "../../../model/db/DbDeviceSpeaker.js";
import { DbDeviceSpeakerSource } from "../../../model/db/DbDeviceSpeakerSource.js";
import { DbDeviceSpeakerSubwoofer } from "../../../model/db/DbDeviceSpeakerSubwoofer.js";
import { DbDeviceSpeakerZone } from "../../../model/db/DbDeviceSpeakerZone.js";
import {
  asRecordArray,
  assignIfSet,
  groupByDevice,
  replaceRows,
  toNullableBoolean,
  toNullableNumber,
  toNullableString,
  withoutNulls,
  type DeviceTableGroup
} from "./deviceTableGroup.js";

const SQL_SELECT_SPEAKERS = `
  SELECT
      s.device_id    AS deviceId,
      s.play_state   AS playState,
      s.volume,
      s.is_muted     AS isMuted,
      s.volume_start AS volumeStart,
      s.volume_max   AS volumeMax
  FROM device_speakers AS s`;

const SQL_UPSERT_SPEAKER = `
  INSERT INTO device_speakers (device_id, play_state, volume, is_muted, volume_start, volume_max)
  VALUES (?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      play_state   = incoming.play_state,
      volume       = incoming.volume,
      is_muted     = incoming.is_muted,
      volume_start = incoming.volume_start,
      volume_max   = incoming.volume_max`;

const SQL_SELECT_ZONES = `
  SELECT
      z.device_id    AS deviceId,
      z.sort_index   AS sortIndex,
      z.name,
      z.display_name AS displayName,
      z.is_powered   AS isPowered
  FROM device_speaker_zones AS z
  ORDER BY z.device_id, z.sort_index`;

const SQL_DELETE_ZONES = `
  DELETE FROM device_speaker_zones
  WHERE device_id = ?`;

const SQL_INSERT_ZONE = `
  INSERT INTO device_speaker_zones (device_id, sort_index, name, display_name, is_powered)
  VALUES (?, ?, ?, ?, ?)`;

const SQL_SELECT_SUBWOOFERS = `
  SELECT
      w.device_id    AS deviceId,
      w.sort_index   AS sortIndex,
      w.subwoofer_id AS subwooferId,
      w.name,
      w.is_powered   AS isPowered,
      w.level_db     AS levelDb
  FROM device_speaker_subwoofers AS w
  ORDER BY w.device_id, w.sort_index`;

const SQL_DELETE_SUBWOOFERS = `
  DELETE FROM device_speaker_subwoofers
  WHERE device_id = ?`;

const SQL_INSERT_SUBWOOFER = `
  INSERT INTO device_speaker_subwoofers (device_id, sort_index, subwoofer_id, name, is_powered, level_db)
  VALUES (?, ?, ?, ?, ?, ?)`;

const SQL_SELECT_SOURCES = `
  SELECT
      q.device_id    AS deviceId,
      q.sort_index   AS sortIndex,
      q.source_key   AS sourceKey,
      q.display_name AS displayName,
      q.is_selected  AS isSelected
  FROM device_speaker_sources AS q
  ORDER BY q.device_id, q.sort_index`;

const SQL_DELETE_SOURCES = `
  DELETE FROM device_speaker_sources
  WHERE device_id = ?`;

const SQL_INSERT_SOURCE = `
  INSERT INTO device_speaker_sources (device_id, sort_index, source_key, display_name, is_selected)
  VALUES (?, ?, ?, ?, ?)`;

const SPEAKER_TYPES = new Set<string>([DeviceType.SPEAKER, DeviceType.SPEAKER_RECEIVER]);
const PLAY_STATES = new Set<string>(["play", "pause", "stop"]);

function toPlayState(value: unknown): DbPlayState | null {
  return typeof value === "string" && PLAY_STATES.has(value) ? (value as DbPlayState) : null;
}

/** Lautsprecher; Zonen, Subwoofer, Quellen und Lautstärkegrenzen gibt es nur bei Receivern. */
export const speakerTables: DeviceTableGroup = {
  appliesTo: device => SPEAKER_TYPES.has(device.type ?? ""),

  async load(db, devices) {
    const speakers = await db.query<RowDataPacket>(SQL_SELECT_SPEAKERS);
    for (const row of speakers) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const speaker = new DbDeviceSpeaker({
        deviceId: row.deviceId,
        playState: toPlayState(row.playState),
        volume: toNullableNumber(row.volume),
        isMuted: toNullableBoolean(row.isMuted),
        volumeStart: toNullableNumber(row.volumeStart),
        volumeMax: toNullableNumber(row.volumeMax)
      });
      assignIfSet(device, "playState", speaker.playState);
      assignIfSet(device, "volume", speaker.volume);
      assignIfSet(device, "muted", speaker.isMuted);
      assignIfSet(device, "volumeStart", speaker.volumeStart);
      assignIfSet(device, "volumeMax", speaker.volumeMax);
    }

    for (const [deviceId, rows] of groupByDevice(await db.query<RowDataPacket>(SQL_SELECT_ZONES))) {
      const device = devices.get(deviceId);
      if (!device) continue;
      device.zones = rows
        .map(row => new DbDeviceSpeakerZone({
          deviceId,
          sortIndex: row.sortIndex,
          name: row.name,
          displayName: row.displayName,
          isPowered: toNullableBoolean(row.isPowered)
        }))
        .map(zone => withoutNulls({ name: zone.name, displayName: zone.displayName, power: zone.isPowered }));
    }

    for (const [deviceId, rows] of groupByDevice(await db.query<RowDataPacket>(SQL_SELECT_SUBWOOFERS))) {
      const device = devices.get(deviceId);
      if (!device) continue;
      device.subwoofers = rows
        .map(row => new DbDeviceSpeakerSubwoofer({
          deviceId,
          sortIndex: row.sortIndex,
          subwooferId: row.subwooferId,
          name: row.name,
          isPowered: toNullableBoolean(row.isPowered),
          levelDb: toNullableNumber(row.levelDb)
        }))
        .map(subwoofer => withoutNulls({
          id: subwoofer.subwooferId,
          name: subwoofer.name,
          power: subwoofer.isPowered,
          db: subwoofer.levelDb
        }));
    }

    for (const [deviceId, rows] of groupByDevice(await db.query<RowDataPacket>(SQL_SELECT_SOURCES))) {
      const device = devices.get(deviceId);
      if (!device) continue;
      device.sources = rows
        .map(row => new DbDeviceSpeakerSource({
          deviceId,
          sortIndex: row.sortIndex,
          sourceKey: row.sourceKey,
          displayName: row.displayName,
          isSelected: toNullableBoolean(row.isSelected)
        }))
        .map(source => withoutNulls({
          index: source.sourceKey,
          displayName: source.displayName,
          selected: source.isSelected
        }));
    }
  },

  async save(tx, device) {
    const speaker = new DbDeviceSpeaker({
      deviceId: device.id,
      playState: toPlayState(device.playState),
      volume: toNullableNumber(device.volume),
      isMuted: toNullableBoolean(device.muted),
      volumeStart: toNullableNumber(device.volumeStart),
      volumeMax: toNullableNumber(device.volumeMax)
    });
    await tx.execute(SQL_UPSERT_SPEAKER, [
      speaker.deviceId,
      speaker.playState,
      speaker.volume,
      speaker.isMuted,
      speaker.volumeStart,
      speaker.volumeMax
    ]);

    const zones = asRecordArray(device.zones).map((zone, sortIndex) => new DbDeviceSpeakerZone({
      deviceId: device.id,
      sortIndex,
      name: toNullableString(zone.name),
      displayName: toNullableString(zone.displayName),
      isPowered: toNullableBoolean(zone.power)
    }));
    await replaceRows(tx, SQL_DELETE_ZONES, SQL_INSERT_ZONE, device.id, zones.map(zone => [
      zone.deviceId,
      zone.sortIndex,
      zone.name,
      zone.displayName,
      zone.isPowered
    ]));

    const subwoofers = asRecordArray(device.subwoofers).map((subwoofer, sortIndex) => new DbDeviceSpeakerSubwoofer({
      deviceId: device.id,
      sortIndex,
      subwooferId: toNullableString(subwoofer.id),
      name: toNullableString(subwoofer.name),
      isPowered: toNullableBoolean(subwoofer.power),
      levelDb: toNullableNumber(subwoofer.db)
    }));
    await replaceRows(tx, SQL_DELETE_SUBWOOFERS, SQL_INSERT_SUBWOOFER, device.id, subwoofers.map(subwoofer => [
      subwoofer.deviceId,
      subwoofer.sortIndex,
      subwoofer.subwooferId,
      subwoofer.name,
      subwoofer.isPowered,
      subwoofer.levelDb
    ]));

    const sources = asRecordArray(device.sources).map((source, sortIndex) => new DbDeviceSpeakerSource({
      deviceId: device.id,
      sortIndex,
      sourceKey: toNullableString(source.index),
      displayName: toNullableString(source.displayName),
      isSelected: toNullableBoolean(source.selected)
    }));
    await replaceRows(tx, SQL_DELETE_SOURCES, SQL_INSERT_SOURCE, device.id, sources.map(source => [
      source.deviceId,
      source.sortIndex,
      source.sourceKey,
      source.displayName,
      source.isSelected
    ]));
  }
};
