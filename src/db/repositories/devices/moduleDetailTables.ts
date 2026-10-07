import type { RowDataPacket } from "mysql2/promise";
import { DbDeviceHeosDetail } from "../../../model/db/DbDeviceHeosDetail.js";
import { DbDeviceHueDetail } from "../../../model/db/DbDeviceHueDetail.js";
import { DbDeviceLgDetail } from "../../../model/db/DbDeviceLgDetail.js";
import { DbDeviceMatterDetail } from "../../../model/db/DbDeviceMatterDetail.js";
import { DbDeviceSonosDetail } from "../../../model/db/DbDeviceSonosDetail.js";
import { DbDeviceVoiceAssistantDetail } from "../../../model/db/DbDeviceVoiceAssistantDetail.js";
import { DbDeviceWacDetail } from "../../../model/db/DbDeviceWacDetail.js";
import { DbDeviceXiaomiDetail } from "../../../model/db/DbDeviceXiaomiDetail.js";
import {
  assignIfSet,
  toNullableNumber,
  toNullableString,
  type DeviceTableGroup
} from "./deviceTableGroup.js";

// --- Hue ---------------------------------------------------------------------

const SQL_SELECT_HUE_DETAILS = `
  SELECT
      h.device_id               AS deviceId,
      h.bridge_id               AS bridgeId,
      h.resource_id             AS resourceId,
      h.battery_resource_id     AS batteryResourceId,
      h.motion_resource_id      AS motionResourceId,
      h.light_level_resource_id AS lightLevelResourceId,
      h.temperature_resource_id AS temperatureResourceId
  FROM device_hue_details AS h`;

const SQL_UPSERT_HUE_DETAIL = `
  INSERT INTO device_hue_details (
      device_id, bridge_id, resource_id, battery_resource_id,
      motion_resource_id, light_level_resource_id, temperature_resource_id
  )
  VALUES (?, ?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      bridge_id               = incoming.bridge_id,
      resource_id             = incoming.resource_id,
      battery_resource_id     = incoming.battery_resource_id,
      motion_resource_id      = incoming.motion_resource_id,
      light_level_resource_id = incoming.light_level_resource_id,
      temperature_resource_id = incoming.temperature_resource_id`;

export const hueDetailTables: DeviceTableGroup = {
  appliesTo: device => device.moduleId === "hue",

  async load(db, devices) {
    for (const row of await db.query<RowDataPacket>(SQL_SELECT_HUE_DETAILS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const detail = new DbDeviceHueDetail({
        deviceId: row.deviceId,
        bridgeId: row.bridgeId,
        resourceId: row.resourceId,
        batteryResourceId: row.batteryResourceId,
        motionResourceId: row.motionResourceId,
        lightLevelResourceId: row.lightLevelResourceId,
        temperatureResourceId: row.temperatureResourceId
      });
      assignIfSet(device, "bridgeId", detail.bridgeId);
      assignIfSet(device, "hueResourceId", detail.resourceId);
      assignIfSet(device, "batteryRid", detail.batteryResourceId);
      assignIfSet(device, "motionRid", detail.motionResourceId);
      assignIfSet(device, "lightLevelRid", detail.lightLevelResourceId);
      assignIfSet(device, "temperatureRid", detail.temperatureResourceId);
    }
  },

  async save(tx, device) {
    const detail = new DbDeviceHueDetail({
      deviceId: device.id,
      bridgeId: toNullableString(device.bridgeId),
      resourceId: toNullableString(device.hueResourceId),
      batteryResourceId: toNullableString(device.batteryRid),
      motionResourceId: toNullableString(device.motionRid),
      lightLevelResourceId: toNullableString(device.lightLevelRid),
      temperatureResourceId: toNullableString(device.temperatureRid)
    });
    await tx.execute(SQL_UPSERT_HUE_DETAIL, [
      detail.deviceId,
      detail.bridgeId,
      detail.resourceId,
      detail.batteryResourceId,
      detail.motionResourceId,
      detail.lightLevelResourceId,
      detail.temperatureResourceId
    ]);
  }
};

// --- Matter ------------------------------------------------------------------

const SQL_SELECT_MATTER_DETAILS = `
  SELECT
      m.device_id AS deviceId,
      m.node_id   AS nodeId
  FROM device_matter_details AS m`;

const SQL_UPSERT_MATTER_DETAIL = `
  INSERT INTO device_matter_details (device_id, node_id)
  VALUES (?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      node_id = incoming.node_id`;

export const matterDetailTables: DeviceTableGroup = {
  appliesTo: device => device.moduleId === "matter",

  async load(db, devices) {
    for (const row of await db.query<RowDataPacket>(SQL_SELECT_MATTER_DETAILS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const detail = new DbDeviceMatterDetail({ deviceId: row.deviceId, nodeId: row.nodeId });
      assignIfSet(device, "nodeId", detail.nodeId);
    }
  },

  async save(tx, device) {
    const detail = new DbDeviceMatterDetail({ deviceId: device.id, nodeId: toNullableString(device.nodeId) });
    await tx.execute(SQL_UPSERT_MATTER_DETAIL, [detail.deviceId, detail.nodeId]);
  }
};

// --- Xiaomi ------------------------------------------------------------------

const SQL_SELECT_XIAOMI_DETAILS = `
  SELECT
      x.device_id AS deviceId,
      x.address,
      x.token,
      x.model,
      x.did
  FROM device_xiaomi_details AS x`;

const SQL_UPSERT_XIAOMI_DETAIL = `
  INSERT INTO device_xiaomi_details (device_id, address, token, model, did)
  VALUES (?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      address = incoming.address,
      token   = incoming.token,
      model   = incoming.model,
      did     = incoming.did`;

export const xiaomiDetailTables: DeviceTableGroup = {
  appliesTo: device => device.moduleId === "xiaomi",

  async load(db, devices) {
    for (const row of await db.query<RowDataPacket>(SQL_SELECT_XIAOMI_DETAILS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const detail = new DbDeviceXiaomiDetail({
        deviceId: row.deviceId,
        address: row.address,
        token: row.token,
        model: row.model,
        did: row.did
      });
      assignIfSet(device, "address", detail.address);
      assignIfSet(device, "token", detail.token);
      assignIfSet(device, "model", detail.model);
      assignIfSet(device, "did", detail.did);
    }
  },

  async save(tx, device) {
    const detail = new DbDeviceXiaomiDetail({
      deviceId: device.id,
      address: toNullableString(device.address),
      token: toNullableString(device.token),
      model: toNullableString(device.model),
      did: toNullableString(device.did)
    });
    await tx.execute(SQL_UPSERT_XIAOMI_DETAIL, [detail.deviceId, detail.address, detail.token, detail.model, detail.did]);
  }
};

// --- LG ----------------------------------------------------------------------

const SQL_SELECT_LG_DETAILS = `
  SELECT
      l.device_id   AS deviceId,
      l.address,
      l.client_key  AS clientKey,
      l.mac_address AS macAddress
  FROM device_lg_details AS l`;

const SQL_UPSERT_LG_DETAIL = `
  INSERT INTO device_lg_details (device_id, address, client_key, mac_address)
  VALUES (?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      address     = incoming.address,
      client_key  = incoming.client_key,
      mac_address = incoming.mac_address`;

export const lgDetailTables: DeviceTableGroup = {
  appliesTo: device => device.moduleId === "lg",

  async load(db, devices) {
    for (const row of await db.query<RowDataPacket>(SQL_SELECT_LG_DETAILS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const detail = new DbDeviceLgDetail({
        deviceId: row.deviceId,
        address: row.address,
        clientKey: row.clientKey,
        macAddress: row.macAddress
      });
      assignIfSet(device, "address", detail.address);
      assignIfSet(device, "clientKey", detail.clientKey);
      assignIfSet(device, "macAddress", detail.macAddress);
    }
  },

  async save(tx, device) {
    const detail = new DbDeviceLgDetail({
      deviceId: device.id,
      address: toNullableString(device.address),
      clientKey: toNullableString(device.clientKey),
      macAddress: toNullableString(device.macAddress)
    });
    await tx.execute(SQL_UPSERT_LG_DETAIL, [detail.deviceId, detail.address, detail.clientKey, detail.macAddress]);
  }
};

// --- Sonos -------------------------------------------------------------------

const SQL_SELECT_SONOS_DETAILS = `
  SELECT
      s.device_id AS deviceId,
      s.address,
      s.room_name AS roomName
  FROM device_sonos_details AS s`;

const SQL_UPSERT_SONOS_DETAIL = `
  INSERT INTO device_sonos_details (device_id, address, room_name)
  VALUES (?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      address   = incoming.address,
      room_name = incoming.room_name`;

export const sonosDetailTables: DeviceTableGroup = {
  appliesTo: device => device.moduleId === "sonos",

  async load(db, devices) {
    for (const row of await db.query<RowDataPacket>(SQL_SELECT_SONOS_DETAILS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const detail = new DbDeviceSonosDetail({ deviceId: row.deviceId, address: row.address, roomName: row.roomName });
      assignIfSet(device, "address", detail.address);
      assignIfSet(device, "roomName", detail.roomName);
    }
  },

  async save(tx, device) {
    const detail = new DbDeviceSonosDetail({
      deviceId: device.id,
      address: toNullableString(device.address),
      roomName: toNullableString(device.roomName)
    });
    await tx.execute(SQL_UPSERT_SONOS_DETAIL, [detail.deviceId, detail.address, detail.roomName]);
  }
};

// --- HEOS (Denon) ------------------------------------------------------------

const SQL_SELECT_HEOS_DETAILS = `
  SELECT
      h.device_id AS deviceId,
      h.address,
      h.pid
  FROM device_heos_details AS h`;

const SQL_UPSERT_HEOS_DETAIL = `
  INSERT INTO device_heos_details (device_id, address, pid)
  VALUES (?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      address = incoming.address,
      pid     = incoming.pid`;

const HEOS_MODULE_IDS = new Set(["denon", "heos"]);

export const heosDetailTables: DeviceTableGroup = {
  appliesTo: device => HEOS_MODULE_IDS.has(device.moduleId ?? ""),

  async load(db, devices) {
    for (const row of await db.query<RowDataPacket>(SQL_SELECT_HEOS_DETAILS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const detail = new DbDeviceHeosDetail({
        deviceId: row.deviceId,
        address: row.address,
        pid: toNullableNumber(row.pid)
      });
      assignIfSet(device, "address", detail.address);
      assignIfSet(device, "pid", detail.pid);
    }
  },

  async save(tx, device) {
    const detail = new DbDeviceHeosDetail({
      deviceId: device.id,
      address: toNullableString(device.address),
      pid: toNullableNumber(device.pid)
    });
    await tx.execute(SQL_UPSERT_HEOS_DETAIL, [detail.deviceId, detail.address, detail.pid]);
  }
};

// --- WAC Lighting ------------------------------------------------------------

const SQL_SELECT_WAC_DETAILS = `
  SELECT
      w.device_id AS deviceId,
      w.address,
      w.port
  FROM device_wac_details AS w`;

const SQL_UPSERT_WAC_DETAIL = `
  INSERT INTO device_wac_details (device_id, address, port)
  VALUES (?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      address = incoming.address,
      port    = incoming.port`;

export const wacDetailTables: DeviceTableGroup = {
  appliesTo: device => device.moduleId === "waclighting",

  async load(db, devices) {
    for (const row of await db.query<RowDataPacket>(SQL_SELECT_WAC_DETAILS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const detail = new DbDeviceWacDetail({
        deviceId: row.deviceId,
        address: row.address,
        port: toNullableNumber(row.port)
      });
      assignIfSet(device, "address", detail.address);
      assignIfSet(device, "port", detail.port);
    }
  },

  async save(tx, device) {
    const detail = new DbDeviceWacDetail({
      deviceId: device.id,
      address: toNullableString(device.address),
      port: toNullableNumber(device.port)
    });
    await tx.execute(SQL_UPSERT_WAC_DETAIL, [detail.deviceId, detail.address, detail.port]);
  }
};

// --- Sprachassistent ---------------------------------------------------------

const SQL_SELECT_VOICE_ASSISTANT_DETAILS = `
  SELECT
      v.device_id AS deviceId,
      v.keyword,
      v.port,
      v.passcode,
      v.discriminator
  FROM device_voice_assistant_details AS v`;

const SQL_UPSERT_VOICE_ASSISTANT_DETAIL = `
  INSERT INTO device_voice_assistant_details (device_id, keyword, port, passcode, discriminator)
  VALUES (?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      keyword       = incoming.keyword,
      port          = incoming.port,
      passcode      = incoming.passcode,
      discriminator = incoming.discriminator`;

const SQL_DELETE_VOICE_ASSISTANT_DETAIL = `
  DELETE FROM device_voice_assistant_details
  WHERE device_id = ?`;

/** Felder vaKeyword/vaPort/vaPasscode/vaDiscriminator des Sprachassistent-Geräts (MatterVoiceAssistantManager). */
export const voiceAssistantDetailTables: DeviceTableGroup = {
  appliesTo: device => device.moduleId === "voice-assistant",

  async load(db, devices) {
    for (const row of await db.query<RowDataPacket>(SQL_SELECT_VOICE_ASSISTANT_DETAILS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const detail = new DbDeviceVoiceAssistantDetail({
        deviceId: row.deviceId,
        keyword: row.keyword,
        port: Number(row.port),
        passcode: Number(row.passcode),
        discriminator: Number(row.discriminator)
      });
      device.vaKeyword = detail.keyword;
      device.vaPort = detail.port;
      device.vaPasscode = detail.passcode;
      device.vaDiscriminator = detail.discriminator;
    }
  },

  async save(tx, device) {
    const keyword = toNullableString(device.vaKeyword);
    const port = toNullableNumber(device.vaPort);
    const passcode = toNullableNumber(device.vaPasscode);
    const discriminator = toNullableNumber(device.vaDiscriminator);
    if (keyword === null || port === null || passcode === null || discriminator === null) {
      await tx.execute(SQL_DELETE_VOICE_ASSISTANT_DETAIL, [device.id]);
      return;
    }
    const detail = new DbDeviceVoiceAssistantDetail({ deviceId: device.id, keyword, port, passcode, discriminator });
    await tx.execute(SQL_UPSERT_VOICE_ASSISTANT_DETAIL, [
      detail.deviceId,
      detail.keyword,
      detail.port,
      detail.passcode,
      detail.discriminator
    ]);
  }
};
