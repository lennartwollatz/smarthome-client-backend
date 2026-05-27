import json
import sqlite3

db_path = r"d:\Documente\smarthome\smarthome-client-backend\src\main\node\data\smarthomeNew.sqlite"
db = sqlite3.connect(db_path)

rows = db.execute(
    "SELECT id, length(data) FROM objects WHERE type='BmwCarTelemetryHistory'"
).fetchall()
print("Telemetry rows:", rows)

devices = [
    (row[0], json.loads(row[1]).get("vin"))
    for row in db.execute("SELECT id, data FROM objects WHERE type='Device'").fetchall()
    if json.loads(row[1]).get("moduleId") == "bmw"
]
print("BMW devices:", devices)

door_key = "vehicle.cabin.door.row1.driver.isOpen"
lat_key = "vehicle.cabin.infotainment.navigation.currentLocation.latitude"
range_key = "vehicle.drivetrain.lastRemainingRange"

for id_, _ in rows:
    data = json.loads(
        db.execute(
            "SELECT data FROM objects WHERE id=? AND type='BmwCarTelemetryHistory'",
            (id_,),
        ).fetchone()[0]
    )
    series = data.get("series", {})
    door = series.get(door_key, [])
    lat = series.get(lat_key, [])
    rng = series.get(range_key, [])
    print(f"\n--- {id_} ---")
    print("all series counts:")
    for k, pts in sorted(series.items(), key=lambda x: -len(x[1])):
        print(f"  {len(pts):4d}  {k}")

# Event log sample
all_events = []
event_types = {}
for row in db.execute("SELECT id, data FROM objects WHERE type='EventLog'").fetchall():
    entry = json.loads(row[1])
    et = entry.get("eventType", "?")
    event_types[et] = event_types.get(et, 0) + 1
    if entry.get("eventType") == "carMqttReceived":
        all_events.append((entry.get("timestamp"), entry.get("deviceId"), row[0]))
all_events.sort(key=lambda x: x[0] or 0, reverse=True)
print("\nEvent types:", sorted(event_types.items(), key=lambda x: -x[1])[:10])
print("CAR_MQTT events total:", len(all_events))
print("deviceIds in events:", sorted({e[1] for e in all_events}))
print("Recent events:", all_events[:5])

# Door data in event log
door_key = "vehicle.cabin.door.row1.driver.isOpen"
door_in_events = 0
for row in db.execute("SELECT data FROM objects WHERE type='EventLog'").fetchall():
    entry = json.loads(row[0])
    if entry.get("eventType") != "carMqttReceived":
        continue
    for r in entry.get("results", []):
        if r.get("name") != "data":
            continue
        data = r.get("value") or {}
        if door_key in data:
            door_in_events += 1
            break
print("MQTT events with driver door key:", door_in_events)

db.close()
