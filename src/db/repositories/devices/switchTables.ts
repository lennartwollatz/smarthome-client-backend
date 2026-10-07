import type { RowDataPacket } from "mysql2/promise";
import { DeviceType } from "../../../model/devices/helper/DeviceType.js";
import { DbDeviceButton } from "../../../model/db/DbDeviceButton.js";
import { DbDeviceEnergyReading } from "../../../model/db/DbDeviceEnergyReading.js";
import { DbDeviceEnergyTotal } from "../../../model/db/DbDeviceEnergyTotal.js";
import {
  asRecordArray,
  groupByDevice,
  isRecord,
  replaceRows,
  toNullableBoolean,
  toNullableNumber,
  toNullableString,
  type DeviceTableGroup
} from "./deviceTableGroup.js";

const SQL_SELECT_BUTTONS = `
  SELECT
      b.device_id             AS deviceId,
      b.button_id             AS buttonId,
      b.sort_index            AS sortIndex,
      b.name,
      b.is_connected_to_light AS isConnectedToLight,
      b.is_on                 AS isOn,
      b.press_count           AS pressCount,
      b.initial_press_time    AS initialPressTime,
      b.first_press_time      AS firstPressTime,
      b.last_press_time       AS lastPressTime,
      b.intensity
  FROM device_buttons AS b
  ORDER BY b.device_id, b.sort_index`;

const SQL_DELETE_BUTTONS = `
  DELETE FROM device_buttons
  WHERE device_id = ?`;

const SQL_INSERT_BUTTON = `
  INSERT INTO device_buttons (
      device_id, button_id, sort_index, name, is_connected_to_light,
      is_on, press_count, initial_press_time, first_press_time, last_press_time, intensity
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const SQL_SELECT_ENERGY_TOTALS = `
  SELECT
      e.device_id            AS deviceId,
      e.current_usage        AS currentUsage,
      e.today_total          AS todayTotal,
      e.yesterday_until_now  AS yesterdayUntilNow,
      e.yesterday_total      AS yesterdayTotal,
      e.week_total           AS weekTotal,
      e.last_week_until_now  AS lastWeekUntilNow,
      e.last_week_total      AS lastWeekTotal,
      e.month_total          AS monthTotal,
      e.last_month_until_now AS lastMonthUntilNow,
      e.last_month_total     AS lastMonthTotal,
      e.year_total           AS yearTotal,
      e.last_year_until_now  AS lastYearUntilNow,
      e.last_year_total      AS lastYearTotal
  FROM device_energy_totals AS e`;

const SQL_UPSERT_ENERGY_TOTAL = `
  INSERT INTO device_energy_totals (
      device_id, current_usage, today_total, yesterday_until_now, yesterday_total,
      week_total, last_week_until_now, last_week_total,
      month_total, last_month_until_now, last_month_total,
      year_total, last_year_until_now, last_year_total
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      current_usage        = incoming.current_usage,
      today_total          = incoming.today_total,
      yesterday_until_now  = incoming.yesterday_until_now,
      yesterday_total      = incoming.yesterday_total,
      week_total           = incoming.week_total,
      last_week_until_now  = incoming.last_week_until_now,
      last_week_total      = incoming.last_week_total,
      month_total          = incoming.month_total,
      last_month_until_now = incoming.last_month_until_now,
      last_month_total     = incoming.last_month_total,
      year_total           = incoming.year_total,
      last_year_until_now  = incoming.last_year_until_now,
      last_year_total      = incoming.last_year_total`;

const SQL_DELETE_ENERGY_TOTAL = `
  DELETE FROM device_energy_totals
  WHERE device_id = ?`;

const SQL_SELECT_ENERGY_READINGS = `
  SELECT
      r.device_id   AS deviceId,
      r.sort_index  AS sortIndex,
      r.recorded_at AS recordedAt,
      r.usage_value AS usageValue
  FROM device_energy_readings AS r
  ORDER BY r.device_id, r.sort_index`;

const SQL_DELETE_ENERGY_READINGS = `
  DELETE FROM device_energy_readings
  WHERE device_id = ?`;

const SQL_INSERT_ENERGY_READING = `
  INSERT INTO device_energy_readings (device_id, sort_index, recorded_at, usage_value)
  VALUES (?, ?, ?, ?)`;

const SWITCH_TYPES = new Set<string>([DeviceType.SWITCH, DeviceType.SWITCH_DIMMER, DeviceType.SWITCH_ENERGY]);

/** Tasten von Schaltern (Feld `buttons`, Schlüssel = Tasten-ID); auch das Sprachassistent-Gerät ist ein Schalter. */
export const buttonTables: DeviceTableGroup = {
  appliesTo: device => SWITCH_TYPES.has(device.type ?? "") || isRecord(device.buttons),

  async load(db, devices) {
    const rows = await db.query<RowDataPacket>(SQL_SELECT_BUTTONS);
    for (const [deviceId, deviceRows] of groupByDevice(rows)) {
      const device = devices.get(deviceId);
      if (!device) continue;
      const buttons: Record<string, Record<string, unknown>> = {};
      for (const row of deviceRows) {
        const button = new DbDeviceButton({
          deviceId,
          buttonId: row.buttonId,
          sortIndex: row.sortIndex,
          name: row.name,
          isConnectedToLight: toNullableBoolean(row.isConnectedToLight),
          isOn: toNullableBoolean(row.isOn) ?? false,
          pressCount: Number(row.pressCount),
          initialPressTime: Number(row.initialPressTime),
          firstPressTime: Number(row.firstPressTime),
          lastPressTime: Number(row.lastPressTime),
          intensity: toNullableNumber(row.intensity)
        });
        buttons[button.buttonId] = {
          on: button.isOn,
          pressCount: button.pressCount,
          initialPressTime: button.initialPressTime,
          lastPressTime: button.lastPressTime,
          firstPressTime: button.firstPressTime,
          ...(button.name !== null ? { name: button.name } : {}),
          ...(button.isConnectedToLight !== null ? { connectedToLight: button.isConnectedToLight } : {}),
          ...(button.intensity !== null ? { intensity: button.intensity } : {})
        };
      }
      device.buttons = buttons;
    }
  },

  async save(tx, device) {
    const entries = isRecord(device.buttons) ? Object.entries(device.buttons) : [];
    const buttons = entries
      .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
      .map(([buttonId, button], sortIndex) => new DbDeviceButton({
        deviceId: device.id,
        buttonId,
        sortIndex,
        name: toNullableString(button.name),
        isConnectedToLight: toNullableBoolean(button.connectedToLight),
        isOn: toNullableBoolean(button.on) ?? false,
        pressCount: toNullableNumber(button.pressCount) ?? 0,
        initialPressTime: toNullableNumber(button.initialPressTime) ?? 0,
        firstPressTime: toNullableNumber(button.firstPressTime) ?? 0,
        lastPressTime: toNullableNumber(button.lastPressTime) ?? 0,
        intensity: toNullableNumber(button.intensity)
      }));
    await replaceRows(tx, SQL_DELETE_BUTTONS, SQL_INSERT_BUTTON, device.id, buttons.map(button => [
      button.deviceId,
      button.buttonId,
      button.sortIndex,
      button.name,
      button.isConnectedToLight,
      button.isOn,
      button.pressCount,
      button.initialPressTime,
      button.firstPressTime,
      button.lastPressTime,
      button.intensity
    ]));
  }
};

/** Verbrauchssummen und -verlauf von Energie-Schaltern (Felder `energyUsage` und `energyUsages`). */
export const energyTables: DeviceTableGroup = {
  appliesTo: device => device.type === DeviceType.SWITCH_ENERGY,

  async load(db, devices) {
    const totals = await db.query<RowDataPacket>(SQL_SELECT_ENERGY_TOTALS);
    for (const row of totals) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const total = new DbDeviceEnergyTotal({
        deviceId: row.deviceId,
        currentUsage: Number(row.currentUsage),
        todayTotal: Number(row.todayTotal),
        yesterdayUntilNow: Number(row.yesterdayUntilNow),
        yesterdayTotal: Number(row.yesterdayTotal),
        weekTotal: Number(row.weekTotal),
        lastWeekUntilNow: Number(row.lastWeekUntilNow),
        lastWeekTotal: Number(row.lastWeekTotal),
        monthTotal: Number(row.monthTotal),
        lastMonthUntilNow: Number(row.lastMonthUntilNow),
        lastMonthTotal: Number(row.lastMonthTotal),
        yearTotal: Number(row.yearTotal),
        lastYearUntilNow: Number(row.lastYearUntilNow),
        lastYearTotal: Number(row.lastYearTotal)
      });
      device.energyUsage = {
        now: total.currentUsage,
        tt: total.todayTotal,
        ltt: total.yesterdayUntilNow,
        lt: total.yesterdayTotal,
        wt: total.weekTotal,
        lwt: total.lastWeekUntilNow,
        lw: total.lastWeekTotal,
        mt: total.monthTotal,
        lmt: total.lastMonthUntilNow,
        lm: total.lastMonthTotal,
        yt: total.yearTotal,
        ylt: total.lastYearUntilNow,
        yl: total.lastYearTotal
      };
    }

    const readings = await db.query<RowDataPacket>(SQL_SELECT_ENERGY_READINGS);
    for (const [deviceId, deviceRows] of groupByDevice(readings)) {
      const device = devices.get(deviceId);
      if (!device) continue;
      device.energyUsages = deviceRows
        .map(row => new DbDeviceEnergyReading({
          deviceId,
          sortIndex: row.sortIndex,
          recordedAt: Number(row.recordedAt),
          usageValue: Number(row.usageValue)
        }))
        .map(reading => ({ time: reading.recordedAt, value: reading.usageValue }));
    }
  },

  async save(tx, device) {
    const usage = isRecord(device.energyUsage) ? device.energyUsage : null;
    if (usage) {
      const total = new DbDeviceEnergyTotal({
        deviceId: device.id,
        currentUsage: toNullableNumber(usage.now) ?? 0,
        todayTotal: toNullableNumber(usage.tt) ?? 0,
        yesterdayUntilNow: toNullableNumber(usage.ltt) ?? 0,
        yesterdayTotal: toNullableNumber(usage.lt) ?? 0,
        weekTotal: toNullableNumber(usage.wt) ?? 0,
        lastWeekUntilNow: toNullableNumber(usage.lwt) ?? 0,
        lastWeekTotal: toNullableNumber(usage.lw) ?? 0,
        monthTotal: toNullableNumber(usage.mt) ?? 0,
        lastMonthUntilNow: toNullableNumber(usage.lmt) ?? 0,
        lastMonthTotal: toNullableNumber(usage.lm) ?? 0,
        yearTotal: toNullableNumber(usage.yt) ?? 0,
        lastYearUntilNow: toNullableNumber(usage.ylt) ?? 0,
        lastYearTotal: toNullableNumber(usage.yl) ?? 0
      });
      await tx.execute(SQL_UPSERT_ENERGY_TOTAL, [
        total.deviceId,
        total.currentUsage,
        total.todayTotal,
        total.yesterdayUntilNow,
        total.yesterdayTotal,
        total.weekTotal,
        total.lastWeekUntilNow,
        total.lastWeekTotal,
        total.monthTotal,
        total.lastMonthUntilNow,
        total.lastMonthTotal,
        total.yearTotal,
        total.lastYearUntilNow,
        total.lastYearTotal
      ]);
    } else {
      await tx.execute(SQL_DELETE_ENERGY_TOTAL, [device.id]);
    }

    const readings = asRecordArray(device.energyUsages).map((reading, sortIndex) => new DbDeviceEnergyReading({
      deviceId: device.id,
      sortIndex,
      recordedAt: toNullableNumber(reading.time) ?? 0,
      usageValue: toNullableNumber(reading.value) ?? 0
    }));
    await replaceRows(tx, SQL_DELETE_ENERGY_READINGS, SQL_INSERT_ENERGY_READING, device.id, readings.map(reading => [
      reading.deviceId,
      reading.sortIndex,
      reading.recordedAt,
      reading.usageValue
    ]));
  }
};
