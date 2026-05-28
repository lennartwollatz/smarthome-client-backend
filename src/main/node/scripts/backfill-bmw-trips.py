#!/usr/bin/env python3
"""
Einmaliges Backfill: CAR_MQTT_RECEIVED aus dem Event-Log in BmwCarTelemetryHistory schreiben.
Funktioniert ohne better-sqlite3 (reines Python sqlite3).

Aufruf:
  python scripts/backfill-bmw-trips.py
  python scripts/backfill-bmw-trips.py --db data/smarthomeNew.sqlite
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import datetime
from pathlib import Path

TRACKED_KEYS = {
    "vehicle.cabin.door.row1.driver.isOpen",
    "vehicle.vehicle.travelledDistance",
    "vehicle.drivetrain.lastRemainingRange",
    "vehicle.drivetrain.fuelSystem.level",
    "vehicle.cabin.infotainment.navigation.currentLocation.latitude",
    "vehicle.cabin.infotainment.navigation.currentLocation.longitude",
    "vehicle.cabin.door.status",
    "vehicle.status.car.inUse",
    "vehicle.status.car.inUseState",
}

DOOR_KEY = "vehicle.cabin.door.row1.driver.isOpen"
MILEAGE_KEY = "vehicle.vehicle.travelledDistance"


def load_json_rows(conn: sqlite3.Connection, obj_type: str) -> list[tuple[str, dict]]:
    rows = conn.execute("SELECT id, data FROM objects WHERE type = ?", (obj_type,)).fetchall()
    return [(r[0], json.loads(r[1])) for r in rows]


def save_telemetry(conn: sqlite3.Connection, device_id: str, data: dict) -> None:
    payload = json.dumps(data, separators=(",", ":"))
    conn.execute(
        """
        INSERT INTO objects (id, type, data, updated_at)
        VALUES (?, 'BmwCarTelemetryHistory', ?, datetime('now'))
        ON CONFLICT(id, type) DO UPDATE SET
          data = excluded.data,
          updated_at = datetime('now')
        """,
        (device_id, payload),
    )


def append_point(series: dict, key: str, time_ms: int, value) -> None:
    if key not in TRACKED_KEYS:
        return
    if not isinstance(time_ms, (int, float)):
        return
    time_ms = int(time_ms)
    points = series.setdefault(key, [])
    if points and points[-1].get("value") == value:
        return
    points.append({"time": time_ms, "value": value})


def merge_history(existing: dict | None, incoming: dict) -> dict:
    out = {"series": dict((existing or {}).get("series") or {})}
    for key, pts in incoming.items():
        merged = out["series"].get(key, []) + pts
        seen = set()
        deduped = []
        for p in sorted(merged, key=lambda x: x["time"]):
            sig = (p["time"], json.dumps(p["value"], sort_keys=True))
            if sig in seen:
                continue
            seen.add(sig)
            deduped.append(p)
        out["series"][key] = deduped
    return out


def vin_device_id(vin: str) -> str:
    return f"bmw-{vin.strip().lower()}"


def extract_mqtt_data(entry: dict) -> dict | None:
    for r in entry.get("results") or []:
        if r.get("name") == "data" and isinstance(r.get("value"), dict):
            return r["value"]
    return None


def backfill_device(
    conn: sqlite3.Connection,
    device_id: str,
    vin: str | None,
    mqtt_entries: list[dict],
) -> dict:
    target_ids = {device_id}
    if vin:
        target_ids.add(vin_device_id(vin))

    incoming: dict[str, list] = {}
    matched = 0

    for entry in mqtt_entries:
        if entry.get("eventType") != "carMqttReceived":
            continue
        if entry.get("deviceId") not in target_ids:
            continue
        data = extract_mqtt_data(entry)
        if not data:
            continue
        matched += 1
        envelope_ts = entry.get("timestamp")
        for key, meta in data.items():
            if not isinstance(meta, dict) or "value" not in meta:
                continue
            ts = meta.get("timestamp")
            if not isinstance(ts, (int, float)):
                ts = envelope_ts
            append_point(incoming, key, ts, meta["value"])

    row = conn.execute(
        "SELECT data FROM objects WHERE id = ? AND type = 'BmwCarTelemetryHistory'",
        (device_id,),
    ).fetchone()
    existing = json.loads(row[0]) if row else None
    merged = merge_history(existing, incoming)
    save_telemetry(conn, device_id, merged)

    if vin:
        alt = vin_device_id(vin)
        if alt != device_id:
            save_telemetry(conn, alt, merged)

    series = merged.get("series") or {}
    return {
        "mqttEvents": matched,
        "doorPoints": len(series.get(DOOR_KEY, [])),
        "mileagePoints": len(series.get(MILEAGE_KEY, [])),
    }


def fmt_ts(ms: int | None) -> str:
    if ms is None:
        return "—"
    return datetime.fromtimestamp(ms / 1000).strftime("%d.%m.%Y %H:%M")


def main() -> None:
    parser = argparse.ArgumentParser(description="BMW Telemetrie-Backfill aus Event-Log")
    parser.add_argument(
        "--db",
        default="data/smarthomeNew.sqlite",
        help="Pfad zur SQLite-Datenbank",
    )
    args = parser.parse_args()
    db_path = Path(args.db)
    if not db_path.is_file():
        raise SystemExit(f"Datenbank nicht gefunden: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    devices = [
        (d[0], d[1].get("vin"))
        for d in load_json_rows(conn, "Device")
        if d[1].get("moduleId") == "bmw"
    ]
    event_rows = load_json_rows(conn, "EventLog")
    mqtt_entries = [e[1] for e in event_rows if e[1].get("eventType") == "carMqttReceived"]

    print(f"Datenbank: {db_path.resolve()}")
    print(f"BMW-Fahrzeuge: {len(devices)}")
    print(f"CAR_MQTT Events gesamt: {len(mqtt_entries)}\n")

    if not devices:
        print("Keine BMW-Geräte gefunden.")
        conn.close()
        return

    for device_id, vin in devices:
        print(f"-- {device_id} ({vin or 'ohne VIN'}) --")
        stats = backfill_device(conn, device_id, vin, mqtt_entries)
        print(f"MQTT-Events verarbeitet: {stats['mqttEvents']}")
        print(f"Tür-Punkte in Historie: {stats['doorPoints']}")
        print(f"Tachostand-Punkte: {stats['mileagePoints']}")
        print()

    conn.commit()
    conn.close()
    print(
        "Telemetrie-Backfill abgeschlossen.\n"
        "Backend neu starten, dann:\n"
        "  npm run backfill-bmw-trips   (Fahrten prüfen)\n"
        "  oder POST /modules/bmw/devices/<id>/trips/backfill"
    )


if __name__ == "__main__":
    main()
