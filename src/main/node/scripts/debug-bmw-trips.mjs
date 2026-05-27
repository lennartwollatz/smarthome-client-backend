import Database from "better-sqlite3";

const dbPath = "data/smarthomeNew.sqlite";
const db = new Database(dbPath, { readonly: true });

const telemetryRows = db
  .prepare("SELECT id, length(data) as len FROM objects WHERE type = 'BmwCarTelemetryHistory'")
  .all();
console.log("BmwCarTelemetryHistory rows:", telemetryRows);

const bmwDevices = db
  .prepare(
    "SELECT id, json_extract(data, '$.name') as name, json_extract(data, '$.vin') as vin FROM objects WHERE type = 'Device' AND json_extract(data, '$.moduleId') = 'bmw'"
  )
  .all();
console.log("BMW devices:", bmwDevices);

for (const row of telemetryRows) {
  const data = JSON.parse(
    db.prepare("SELECT data FROM objects WHERE id = ? AND type = 'BmwCarTelemetryHistory'").get(row.id).data
  );
  const series = data.series ?? {};
  const doorKey = "vehicle.cabin.door.row1.driver.isOpen";
  const doorPts = series[doorKey] ?? [];
  const latPts = series["vehicle.cabin.infotainment.navigation.currentLocation.latitude"] ?? [];
  const rangePts = series["vehicle.drivetrain.lastRemainingRange"] ?? [];
  console.log("\n--- device", row.id, "---");
  console.log("door points:", doorPts.length, "sample:", doorPts.slice(0, 5));
  console.log("lat points:", latPts.length, "sample:", latPts.slice(0, 3));
  console.log("range points:", rangePts.length, "sample:", rangePts.slice(0, 3));
  console.log("door value types:", [...new Set(doorPts.map(p => typeof p.value))]);
  console.log("unique door values:", [...new Set(doorPts.map(p => JSON.stringify(p.value)))].slice(0, 10));
}

db.close();
