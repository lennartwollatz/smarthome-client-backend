import type { RowDataPacket } from "mysql2/promise";
import { DeviceType } from "../../../model/devices/helper/DeviceType.js";
import { DbDeviceWeatherForecast } from "../../../model/db/DbDeviceWeatherForecast.js";
import { DbDeviceWeatherHourlyForecast } from "../../../model/db/DbDeviceWeatherHourlyForecast.js";
import { DbDeviceWeatherReport } from "../../../model/db/DbDeviceWeatherReport.js";
import {
  asRecordArray,
  assignIfSet,
  groupByDevice,
  replaceRows,
  toNullableNumber,
  toNullableString,
  withoutNulls,
  type DeviceTableGroup,
  type PlainDevice
} from "./deviceTableGroup.js";

const SQL_SELECT_WEATHER_REPORTS = `
  SELECT
      w.device_id                 AS deviceId,
      w.latitude,
      w.longitude,
      w.temperature,
      w.temperature_min           AS temperatureMin,
      w.temperature_max           AS temperatureMax,
      w.weather_code              AS weatherCode,
      w.humidity,
      w.pressure,
      w.visibility,
      w.uv_index                  AS uvIndex,
      w.wind_speed_mps            AS windSpeedMps,
      w.wind_speed_max            AS windSpeedMax,
      w.wind_direction            AS windDirection,
      w.wind_direction_dominant   AS windDirectionDominant,
      w.precipitation_probability AS precipitationProbability,
      w.rain,
      w.rain_sum                  AS rainSum,
      w.showers,
      w.showers_sum               AS showersSum,
      w.snowfall,
      w.snowfall_sum              AS snowfallSum,
      w.snow_depth                AS snowDepth,
      w.sunrise,
      w.sunset,
      w.daylight_duration         AS daylightDuration,
      w.sunshine_duration         AS sunshineDuration
  FROM device_weather_reports AS w`;

const SQL_UPSERT_WEATHER_REPORT = `
  INSERT INTO device_weather_reports (
      device_id, latitude, longitude,
      temperature, temperature_min, temperature_max, weather_code,
      humidity, pressure, visibility, uv_index,
      wind_speed_mps, wind_speed_max, wind_direction, wind_direction_dominant,
      precipitation_probability, rain, rain_sum, showers, showers_sum,
      snowfall, snowfall_sum, snow_depth,
      sunrise, sunset, daylight_duration, sunshine_duration
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      latitude                  = incoming.latitude,
      longitude                 = incoming.longitude,
      temperature               = incoming.temperature,
      temperature_min           = incoming.temperature_min,
      temperature_max           = incoming.temperature_max,
      weather_code              = incoming.weather_code,
      humidity                  = incoming.humidity,
      pressure                  = incoming.pressure,
      visibility                = incoming.visibility,
      uv_index                  = incoming.uv_index,
      wind_speed_mps            = incoming.wind_speed_mps,
      wind_speed_max            = incoming.wind_speed_max,
      wind_direction            = incoming.wind_direction,
      wind_direction_dominant   = incoming.wind_direction_dominant,
      precipitation_probability = incoming.precipitation_probability,
      rain                      = incoming.rain,
      rain_sum                  = incoming.rain_sum,
      showers                   = incoming.showers,
      showers_sum               = incoming.showers_sum,
      snowfall                  = incoming.snowfall,
      snowfall_sum              = incoming.snowfall_sum,
      snow_depth                = incoming.snow_depth,
      sunrise                   = incoming.sunrise,
      sunset                    = incoming.sunset,
      daylight_duration         = incoming.daylight_duration,
      sunshine_duration         = incoming.sunshine_duration`;

const SQL_SELECT_FORECASTS = `
  SELECT
      f.device_id    AS deviceId,
      f.sort_index   AS sortIndex,
      f.forecast_at  AS forecastAt,
      f.temperature,
      f.weather_code AS weatherCode
  FROM device_weather_forecasts AS f
  ORDER BY f.device_id, f.sort_index`;

const SQL_DELETE_FORECASTS = `
  DELETE FROM device_weather_forecasts
  WHERE device_id = ?`;

const SQL_INSERT_FORECAST = `
  INSERT INTO device_weather_forecasts (device_id, sort_index, forecast_at, temperature, weather_code)
  VALUES (?, ?, ?, ?, ?)`;

const SQL_SELECT_HOURLY_FORECASTS = `
  SELECT
      h.device_id                 AS deviceId,
      h.sort_index                AS sortIndex,
      h.forecast_at               AS forecastAt,
      h.temperature,
      h.weather_code              AS weatherCode,
      h.precipitation_probability AS precipitationProbability
  FROM device_weather_hourly_forecasts AS h
  ORDER BY h.device_id, h.sort_index`;

const SQL_DELETE_HOURLY_FORECASTS = `
  DELETE FROM device_weather_hourly_forecasts
  WHERE device_id = ?`;

const SQL_INSERT_HOURLY_FORECAST = `
  INSERT INTO device_weather_hourly_forecasts (
      device_id, sort_index, forecast_at, temperature, weather_code, precipitation_probability
  )
  VALUES (?, ?, ?, ?, ?, ?)`;

/** Felder von DeviceWeather in der Reihenfolge der Spalten von SQL_UPSERT_WEATHER_REPORT (ohne device_id). */
const REPORT_FIELDS = [
  "latitude",
  "longitude",
  "temperature",
  "temperatureMin",
  "temperatureMax",
  "weatherCode",
  "humidity",
  "pressure",
  "visibility",
  "uvIndex",
  "windSpeedMps",
  "windSpeedMax",
  "windDirection",
  "windDirectionDominant",
  "precipitationProbability",
  "rain",
  "rainSum",
  "showers",
  "showersSum",
  "snowfall",
  "snowfallSum",
  "snowDepth",
  "sunrise",
  "sunset",
  "daylightDuration",
  "sunshineDuration"
] as const satisfies readonly (keyof DbDeviceWeatherReport)[];

const TEXT_FIELDS = new Set<string>(["sunrise", "sunset"]);

function toWeatherReport(deviceId: string, source: Record<string, unknown>): DbDeviceWeatherReport {
  const fields: Record<string, unknown> = { deviceId };
  for (const field of REPORT_FIELDS) {
    fields[field] = TEXT_FIELDS.has(field) ? toNullableString(source[field]) : toNullableNumber(source[field]);
  }
  return new DbDeviceWeatherReport(fields as unknown as DbDeviceWeatherReport);
}

/** Wetter-Geräte: Standort, aktuelle Werte sowie Tages- und Stundenprognose. */
export const weatherTables: DeviceTableGroup = {
  appliesTo: device => device.type === DeviceType.WEATHER,

  async load(db, devices) {
    for (const row of await db.query<RowDataPacket>(SQL_SELECT_WEATHER_REPORTS)) {
      const device = devices.get(row.deviceId);
      if (!device) continue;
      const report = toWeatherReport(row.deviceId, row);
      for (const field of REPORT_FIELDS) {
        assignIfSet(device, field, report[field]);
      }
    }

    for (const [deviceId, rows] of groupByDevice(await db.query<RowDataPacket>(SQL_SELECT_FORECASTS))) {
      const device = devices.get(deviceId);
      if (!device) continue;
      device.forecast = rows
        .map(row => new DbDeviceWeatherForecast({
          deviceId,
          sortIndex: row.sortIndex,
          forecastAt: row.forecastAt,
          temperature: Number(row.temperature),
          weatherCode: Number(row.weatherCode)
        }))
        .map(entry => ({ datetime: entry.forecastAt, temperature: entry.temperature, weatherCode: entry.weatherCode }));
    }

    for (const [deviceId, rows] of groupByDevice(await db.query<RowDataPacket>(SQL_SELECT_HOURLY_FORECASTS))) {
      const device = devices.get(deviceId);
      if (!device) continue;
      device.hourlyForecast = rows
        .map(row => new DbDeviceWeatherHourlyForecast({
          deviceId,
          sortIndex: row.sortIndex,
          forecastAt: row.forecastAt,
          temperature: Number(row.temperature),
          weatherCode: Number(row.weatherCode),
          precipitationProbability: toNullableNumber(row.precipitationProbability)
        }))
        .map(entry => withoutNulls({
          datetime: entry.forecastAt,
          temperature: entry.temperature,
          weatherCode: entry.weatherCode,
          precipitationProbability: entry.precipitationProbability
        }));
    }
  },

  async save(tx, device: PlainDevice) {
    const report = toWeatherReport(device.id, device);
    await tx.execute(SQL_UPSERT_WEATHER_REPORT, [report.deviceId, ...REPORT_FIELDS.map(field => report[field])]);

    const forecasts = asRecordArray(device.forecast).map((entry, sortIndex) => new DbDeviceWeatherForecast({
      deviceId: device.id,
      sortIndex,
      forecastAt: toNullableString(entry.datetime) ?? "",
      temperature: toNullableNumber(entry.temperature) ?? 0,
      weatherCode: toNullableNumber(entry.weatherCode) ?? 0
    }));
    await replaceRows(tx, SQL_DELETE_FORECASTS, SQL_INSERT_FORECAST, device.id, forecasts.map(entry => [
      entry.deviceId,
      entry.sortIndex,
      entry.forecastAt,
      entry.temperature,
      entry.weatherCode
    ]));

    const hourly = asRecordArray(device.hourlyForecast).map((entry, sortIndex) => new DbDeviceWeatherHourlyForecast({
      deviceId: device.id,
      sortIndex,
      forecastAt: toNullableString(entry.datetime) ?? "",
      temperature: toNullableNumber(entry.temperature) ?? 0,
      weatherCode: toNullableNumber(entry.weatherCode) ?? 0,
      precipitationProbability: toNullableNumber(entry.precipitationProbability)
    }));
    await replaceRows(tx, SQL_DELETE_HOURLY_FORECASTS, SQL_INSERT_HOURLY_FORECAST, device.id, hourly.map(entry => [
      entry.deviceId,
      entry.sortIndex,
      entry.forecastAt,
      entry.temperature,
      entry.weatherCode,
      entry.precipitationProbability
    ]));
  }
};
