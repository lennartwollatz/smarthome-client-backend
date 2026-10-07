import type { RowDataPacket } from "mysql2/promise";
import { DeviceType } from "../../../model/devices/helper/DeviceType.js";
import { DbDeviceTv } from "../../../model/db/DbDeviceTv.js";
import { DbDeviceTvApp } from "../../../model/db/DbDeviceTvApp.js";
import { DbDeviceTvChannel } from "../../../model/db/DbDeviceTvChannel.js";
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

const SQL_SELECT_TVS = `
  SELECT
      t.device_id        AS deviceId,
      t.is_powered       AS isPowered,
      t.is_screen_on     AS isScreenOn,
      t.volume,
      t.selected_channel AS selectedChannel,
      t.selected_app     AS selectedApp
  FROM device_tvs AS t`;

const SQL_UPSERT_TV = `
  INSERT INTO device_tvs (device_id, is_powered, is_screen_on, volume, selected_channel, selected_app)
  VALUES (?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      is_powered       = incoming.is_powered,
      is_screen_on     = incoming.is_screen_on,
      volume           = incoming.volume,
      selected_channel = incoming.selected_channel,
      selected_app     = incoming.selected_app`;

const SQL_SELECT_CHANNELS = `
  SELECT
      c.device_id           AS deviceId,
      c.sort_index          AS sortIndex,
      c.channel_id          AS channelId,
      c.name,
      c.channel_number      AS channelNumber,
      c.home_channel_number AS homeChannelNumber,
      c.channel_type        AS channelType,
      c.is_hd               AS isHd,
      c.img_url             AS imgUrl
  FROM device_tv_channels AS c
  ORDER BY c.device_id, c.sort_index`;

const SQL_DELETE_CHANNELS = `
  DELETE FROM device_tv_channels
  WHERE device_id = ?`;

const SQL_INSERT_CHANNEL = `
  INSERT INTO device_tv_channels (
      device_id, sort_index, channel_id, name, channel_number, home_channel_number, channel_type, is_hd, img_url
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const SQL_SELECT_APPS = `
  SELECT
      a.device_id       AS deviceId,
      a.sort_index      AS sortIndex,
      a.app_id          AS appId,
      a.name,
      a.img_url         AS imgUrl,
      a.home_app_number AS homeAppNumber
  FROM device_tv_apps AS a
  ORDER BY a.device_id, a.sort_index`;

const SQL_DELETE_APPS = `
  DELETE FROM device_tv_apps
  WHERE device_id = ?`;

const SQL_INSERT_APP = `
  INSERT INTO device_tv_apps (device_id, sort_index, app_id, name, img_url, home_app_number)
  VALUES (?, ?, ?, ?, ?, ?)`;

export const tvTables: DeviceTableGroup = {
  appliesTo: device => device.type === DeviceType.TV,

  async load(db, devices) {
    for (const row of await db.query<RowDataPacket>(SQL_SELECT_TVS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const tv = new DbDeviceTv({
        deviceId: row.deviceId,
        isPowered: toNullableBoolean(row.isPowered),
        isScreenOn: toNullableBoolean(row.isScreenOn),
        volume: Number(row.volume),
        selectedChannel: row.selectedChannel,
        selectedApp: row.selectedApp
      });
      assignIfSet(device, "power", tv.isPowered);
      assignIfSet(device, "screen", tv.isScreenOn);
      device.volume = tv.volume;
      assignIfSet(device, "selectedChannel", tv.selectedChannel);
      assignIfSet(device, "selectedApp", tv.selectedApp);
    }

    for (const [deviceId, rows] of groupByDevice(await db.query<RowDataPacket>(SQL_SELECT_CHANNELS))) {
      const device = devices.get(deviceId);
      if (!device) continue;
      device.channels = rows
        .map(row => new DbDeviceTvChannel({
          deviceId,
          sortIndex: row.sortIndex,
          channelId: row.channelId,
          name: row.name,
          channelNumber: toNullableNumber(row.channelNumber),
          homeChannelNumber: toNullableNumber(row.homeChannelNumber),
          channelType: row.channelType,
          isHd: toNullableBoolean(row.isHd),
          imgUrl: row.imgUrl
        }))
        .map(channel => withoutNulls({
          id: channel.channelId,
          name: channel.name,
          channelNumber: channel.channelNumber,
          homeChannelNumber: channel.homeChannelNumber,
          channelType: channel.channelType,
          hd: channel.isHd,
          imgUrl: channel.imgUrl
        }));
    }

    for (const [deviceId, rows] of groupByDevice(await db.query<RowDataPacket>(SQL_SELECT_APPS))) {
      const device = devices.get(deviceId);
      if (!device) continue;
      device.apps = rows
        .map(row => new DbDeviceTvApp({
          deviceId,
          sortIndex: row.sortIndex,
          appId: row.appId,
          name: row.name,
          imgUrl: row.imgUrl,
          homeAppNumber: toNullableNumber(row.homeAppNumber)
        }))
        .map(app => withoutNulls({
          id: app.appId,
          name: app.name,
          imgUrl: app.imgUrl,
          homeAppNumber: app.homeAppNumber
        }));
    }
  },

  async save(tx, device) {
    const tv = new DbDeviceTv({
      deviceId: device.id,
      isPowered: toNullableBoolean(device.power),
      isScreenOn: toNullableBoolean(device.screen),
      volume: toNullableNumber(device.volume) ?? 0,
      selectedChannel: toNullableString(device.selectedChannel),
      selectedApp: toNullableString(device.selectedApp)
    });
    await tx.execute(SQL_UPSERT_TV, [
      tv.deviceId,
      tv.isPowered,
      tv.isScreenOn,
      tv.volume,
      tv.selectedChannel,
      tv.selectedApp
    ]);

    const channels = asRecordArray(device.channels).map((channel, sortIndex) => new DbDeviceTvChannel({
      deviceId: device.id,
      sortIndex,
      channelId: toNullableString(channel.id),
      name: toNullableString(channel.name),
      channelNumber: toNullableNumber(channel.channelNumber),
      homeChannelNumber: toNullableNumber(channel.homeChannelNumber),
      channelType: toNullableString(channel.channelType),
      isHd: toNullableBoolean(channel.hd),
      imgUrl: toNullableString(channel.imgUrl)
    }));
    await replaceRows(tx, SQL_DELETE_CHANNELS, SQL_INSERT_CHANNEL, device.id, channels.map(channel => [
      channel.deviceId,
      channel.sortIndex,
      channel.channelId,
      channel.name,
      channel.channelNumber,
      channel.homeChannelNumber,
      channel.channelType,
      channel.isHd,
      channel.imgUrl
    ]));

    const apps = asRecordArray(device.apps).map((app, sortIndex) => new DbDeviceTvApp({
      deviceId: device.id,
      sortIndex,
      appId: toNullableString(app.id),
      name: toNullableString(app.name),
      imgUrl: toNullableString(app.imgUrl),
      homeAppNumber: toNullableNumber(app.homeAppNumber)
    }));
    await replaceRows(tx, SQL_DELETE_APPS, SQL_INSERT_APP, device.id, apps.map(app => [
      app.deviceId,
      app.sortIndex,
      app.appId,
      app.name,
      app.imgUrl,
      app.homeAppNumber
    ]));
  }
};
