/**
 * Einmaliges Cleanup-Skript:
 *   1. Entfernt alle virtuellen Matter-Geräte (VA, Host, Presence) + Persistenz
 *   2. Entfernt alle Aktionen und entfernt deren IDs aus allen Szenen (actionIds / deactivateActionIds)
 *   3. Entfernt alle ML-Events/Snapshots (DataCollector)
 *   4. Erstellt für jeden User ein neues Presence-Gerät
 *   5. Gibt eine Übersicht aller verbleibenden Entitäten aus
 *
 * Aufruf:  npx tsx cleanup.ts
 *
 * Der Server darf dabei NICHT laufen. Nach Ausführung kann diese Datei gelöscht werden.
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  ManualPairingCodeCodec,
  QrPairingCodeCodec,
  CommissioningFlowType,
  DiscoveryCapabilitiesSchema,
} from "@matter/main/types";
import { VendorId } from "@matter/main";

// ─── Konstanten (identisch mit MatterVirtualDeviceManager) ───────────────────

const PRESENCE_BASE_PORT = 5550;
const PRESENCE_VENDOR_ID = 0xfff1;
const PRESENCE_PRODUCT_ID = 0x8001;
const PRESENCE_MODULE_ID = "presence";

const INVALID_PASSCODES = new Set([
  0, 11111111, 22222222, 33333333, 44444444,
  55555555, 66666666, 77777777, 88888888,
  12345678, 87654321,
]);

// ─── DB ──────────────────────────────────────────────────────────────────────

const dbPath = process.env.DB_URL ?? "data/smarthomeNew.sqlite";
const mlDbPath = process.env.ML_DB_URL ?? "data/ml.sqlite";

if (!existsSync(dbPath)) {
  console.error(`Datenbank nicht gefunden: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);
const mlDb = existsSync(mlDbPath) ? new Database(mlDbPath) : null;

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function deleteByType(type: string): number {
  return db.prepare("DELETE FROM objects WHERE type = ?").run(type).changes;
}

function findAllRaw(type: string): { id: string; data: Record<string, unknown> }[] {
  const rows = db
    .prepare("SELECT id, data FROM objects WHERE type = ? ORDER BY created_at DESC")
    .all(type) as { id: string; data: string }[];
  return rows.map((r) => ({ id: r.id, data: JSON.parse(r.data) }));
}

function countByType(type: string): number {
  return (
    db.prepare("SELECT COUNT(*) AS c FROM objects WHERE type = ?").get(type) as { c: number }
  ).c;
}

function findDeviceIdsByJson(condition: string): string[] {
  return (
    db.prepare(`SELECT id FROM objects WHERE type = 'Device' AND ${condition}`).all() as { id: string }[]
  ).map((r) => r.id);
}

function deriveStorageId(deviceId: string): string {
  const hash = createHash("sha256").update(deviceId, "utf8").digest("hex").slice(0, 32);
  const safe = deviceId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return safe.length > 0 && safe.length <= 64 ? safe : `va_${hash.slice(0, 24)}`;
}

async function eraseMatterPersistence(storageId: string, dirs: string[]): Promise<void> {
  for (const dir of dirs) {
    try { await rm(path.join(dir, storageId), { recursive: true, force: true }); } catch { /* ok */ }
    try { await rm(path.join(dir, `${storageId}.db`), { force: true }); } catch { /* ok */ }
  }
}

function guessMatterStorageDirs(): string[] {
  return [
    path.resolve(".matter"),
    path.resolve(".matter-storage"),
    path.resolve("data"),
    path.resolve("."),
  ].filter((d) => existsSync(d));
}

function generatePasscode(): number {
  let pc: number;
  do {
    pc = Math.floor(Math.random() * 99999998) + 1;
  } while (INVALID_PASSCODES.has(pc));
  return pc;
}

function encodePairingCode(discriminator: number, passcode: number): string {
  return ManualPairingCodeCodec.encode({ discriminator, passcode });
}

function encodeQrPairingCode(discriminator: number, passcode: number): string {
  return QrPairingCodeCodec.encode([
    {
      version: 0,
      vendorId: VendorId(PRESENCE_VENDOR_ID),
      productId: PRESENCE_PRODUCT_ID,
      flowType: CommissioningFlowType.Standard,
      discriminator,
      passcode,
      discoveryCapabilities: DiscoveryCapabilitiesSchema.encode({ onIpNetwork: true }),
    },
  ]);
}

function upsertObject(id: string, type: string, data: Record<string, unknown>): void {
  db.prepare(`
    INSERT INTO objects (id, type, data, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(id, type) DO UPDATE SET data = excluded.data, updated_at = datetime('now')
  `).run(id, type, JSON.stringify(data));
}

// ─── Übersichts-Tabelle ──────────────────────────────────────────────────────

function printSection(title: string, rows: { id: string; data: Record<string, unknown> }[], columns: string[]) {
  if (rows.length === 0) {
    console.log(`  (keine Einträge)\n`);
    return;
  }

  const colWidths = columns.map((col) => {
    const vals = rows.map((r) => String(r.data[col] ?? r[col as keyof typeof r] ?? ""));
    return Math.max(col.length, ...vals.map((v) => v.length));
  });

  const header = columns.map((c, i) => c.padEnd(colWidths[i])).join("  |  ");
  const sep = colWidths.map((w) => "-".repeat(w)).join("--+--");
  console.log(`  ${header}`);
  console.log(`  ${sep}`);
  for (const row of rows) {
    const line = columns
      .map((c, i) => String(row.data[c] ?? row[c as keyof typeof row] ?? "").padEnd(colWidths[i]))
      .join("  |  ");
    console.log(`  ${line}`);
  }
  console.log();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║         SmartHome Cleanup-Skript             ║");
  console.log("╚══════════════════════════════════════════════╝\n");
  console.log(`Datenbank: ${path.resolve(dbPath)}\n`);

  const matterDirs = guessMatterStorageDirs();

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHRITT 1: Virtuelle Matter-Geräte entfernen
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("┌─────────────────────────────────────────────┐");
  console.log("│ Schritt 1: Virtuelle Matter-Geräte löschen  │");
  console.log("└─────────────────────────────────────────────┘\n");

  // 1a) VoiceAssistantDevice-Einträge + Persistenz
  const vaEntries = findAllRaw("VoiceAssistantDevice");
  for (const va of vaEntries) {
    await eraseMatterPersistence(deriveStorageId(String(va.data.deviceId ?? va.id)), matterDirs);
  }
  const vaDeleted = deleteByType("VoiceAssistantDevice");
  console.log(`  VoiceAssistantDevice   : ${vaDeleted} Einträge gelöscht`);

  // 1b) MatterHostSwitchDevice-Einträge + Persistenz
  const mhsEntries = findAllRaw("MatterHostSwitchDevice");
  for (const mhs of mhsEntries) {
    await eraseMatterPersistence(deriveStorageId(String(mhs.data.deviceId ?? mhs.id)), matterDirs);
  }
  const mhsDeleted = deleteByType("MatterHostSwitchDevice");
  console.log(`  MatterHostSwitchDevice : ${mhsDeleted} Einträge gelöscht`);

  // 1c) Presence-Persistenz
  const users = findAllRaw("User");
  const usersWithPresence = users.filter((u) => (u.data.presenceDevicePort as number) > 0);
  for (const u of usersWithPresence) {
    await eraseMatterPersistence(`presence-${u.data.id}`, matterDirs);
  }

  // 1d) Device-Einträge (VA + Presence + Host) löschen
  const vaDeviceIds = findDeviceIdsByJson("json_extract(data, '$.moduleId') = 'voice-assistant'");
  const presenceDeviceIds = findDeviceIdsByJson("json_extract(data, '$.moduleId') = 'presence'");
  const hostDeviceIds = findDeviceIdsByJson("json_extract(data, '$.isVirtualMatterHost') = 1");
  const allVirtualIds = [...new Set([...vaDeviceIds, ...presenceDeviceIds, ...hostDeviceIds])];

  if (allVirtualIds.length > 0) {
    const ph = allVirtualIds.map(() => "?").join(",");
    const res = db.prepare(`DELETE FROM objects WHERE type = 'Device' AND id IN (${ph})`).run(...allVirtualIds);
    console.log(`  Device (virtuell)      : ${res.changes} Einträge gelöscht  (VA: ${vaDeviceIds.length}, Presence: ${presenceDeviceIds.length}, Host: ${hostDeviceIds.length})`);
  } else {
    console.log(`  Device (virtuell)      : 0`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHRITT 2: Alle Aktionen entfernen
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n┌─────────────────────────────────────────────┐");
  console.log("│ Schritt 2: Alle Aktionen löschen            │");
  console.log("└─────────────────────────────────────────────┘\n");

  const actionsDeleted = deleteByType("Action");
  console.log(`  Action                 : ${actionsDeleted} Einträge gelöscht`);

  const sceneRows = findAllRaw("Scene");
  let scenesActionsCleared = 0;
  for (const row of sceneRows) {
    const d = row.data;
    const onLen = (d.actionIds as unknown[] | undefined)?.length ?? 0;
    const offLen = (d.deactivateActionIds as unknown[] | undefined)?.length ?? 0;
    if (onLen === 0 && offLen === 0) continue;
    d.actionIds = [];
    d.deactivateActionIds = [];
    upsertObject(row.id, "Scene", d);
    scenesActionsCleared++;
  }
  console.log(`  Scene (Aktionen refs)  : ${scenesActionsCleared} Szenen bereinigt (actionIds / deactivateActionIds geleert)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHRITT 3: ML-Daten (DataCollector) entfernen
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n┌─────────────────────────────────────────────┐");
  console.log("│ Schritt 3: ML-Daten (DataCollector) löschen │");
  console.log("└─────────────────────────────────────────────┘\n");

  if (!mlDb) {
    console.log(`  ML-Datenbank nicht gefunden (${mlDbPath}) – übersprungen.`);
  } else {
    const mlTables = ["ml_events", "ml_snapshots", "l_devices", "l_device_types", "l_rooms", "l_modules", "l_event_types"];
    for (const table of mlTables) {
      try {
        const exists = mlDb.prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
        ).get(table);
        if (exists) {
          const result = mlDb.prepare(`DELETE FROM ${table}`).run();
          console.log(`  ${table.padEnd(20)} : ${result.changes} Zeilen gelöscht`);
        } else {
          console.log(`  ${table.padEnd(20)} : (Tabelle existiert nicht)`);
        }
      } catch (err) {
        console.log(`  ${table.padEnd(20)} : Fehler – ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHRITT 4: Neue Presence-Geräte für jeden User erstellen
  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n┌──────────────────────────────────────────────────────┐");
  console.log("│ Schritt 4: Neue Presence-Geräte für jeden User      │");
  console.log("└──────────────────────────────────────────────────────┘\n");

  const allUsers = findAllRaw("User");
  if (allUsers.length === 0) {
    console.log("  Keine User vorhanden – übersprungen.\n");
  }

  const usedPorts = new Set<number>();
  let nextPort = PRESENCE_BASE_PORT;
  function allocatePort(): number {
    while (usedPorts.has(nextPort)) nextPort++;
    usedPorts.add(nextPort);
    return nextPort++;
  }

  for (const userRow of allUsers) {
    const userData = userRow.data;
    const userId = String(userData.id);
    const displayName = String(userData.name ?? "").trim() || "Unbekannt";
    const nodeId = `presence-${userId}`;

    const passcode = generatePasscode();
    const discriminator = Math.floor(Math.random() * 4096);
    const port = allocatePort();
    const pairingCode = encodePairingCode(discriminator, passcode);
    const qrPairingCode = encodeQrPairingCode(discriminator, passcode);

    // DevicePresence-Objekt speichern (type = "Device")
    const presenceDevice: Record<string, unknown> = {
      id: nodeId,
      name: displayName,
      type: "presence",
      moduleId: PRESENCE_MODULE_ID,
      isConnected: false,
      isConnecting: false,
      isPairingMode: true,
      hasBattery: false,
      batteryLevel: 0,
      quickAccess: false,
      present: userData.present ?? false,
      lastDetect: new Date().toISOString(),
      icon: "🏠",
      typeLabel: "deviceType.presence",
    };
    upsertObject(nodeId, "Device", presenceDevice);

    // User-Felder aktualisieren
    userData.presenceNodeId = nodeId;
    userData.presenceDevicePort = port;
    userData.presencePairingCode = pairingCode;
    userData.presencePasscode = passcode;
    userData.presenceDiscriminator = discriminator;
    userData.presenceDeviceId = nodeId;
    upsertObject(userId, "User", userData);

    console.log(`  ${displayName}`);
    console.log(`    Device-ID     : ${nodeId}`);
    console.log(`    Port          : ${port}`);
    console.log(`    Pairing-Code  : ${pairingCode}`);
    console.log(`    QR-Code       : ${qrPairingCode}`);
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHRITT 5: Übersicht aller verbleibenden Entitäten
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("┌──────────────────────────────────────────────────────┐");
  console.log("│ Übersicht: Verbleibende Entitäten                   │");
  console.log("└──────────────────────────────────────────────────────┘\n");

  // --- Geräte ---
  const devices = findAllRaw("Device");
  console.log(`  ── Geräte (${devices.length}) ${"─".repeat(38)}`);
  printSection("Geräte", devices, ["id", "name", "type", "moduleId", "isConnected"]);

  // --- User ---
  const finalUsers = findAllRaw("User");
  console.log(`  ── User (${finalUsers.length}) ${"─".repeat(39)}`);
  printSection("User", finalUsers, ["id", "name", "role", "presenceDevicePort"]);

  // --- Räume ---
  const rooms = findAllRaw("Room");
  console.log(`  ── Räume (${rooms.length}) ${"─".repeat(38)}`);
  printSection("Räume", rooms, ["id", "name", "icon"]);

  // --- Szenen ---
  const scenes = findAllRaw("Scene");
  console.log(`  ── Szenen (${scenes.length}) ${"─".repeat(37)}`);
  printSection("Szenen", scenes, ["id", "name", "active", "isCustom"]);

  // --- Aktionen ---
  const actions = findAllRaw("Action");
  console.log(`  ── Aktionen (${actions.length}) ${"─".repeat(35)}`);
  printSection("Aktionen", actions, ["actionId", "name", "triggerType", "isActive"]);

  // --- Grundriss ---
  const floorplans = findAllRaw("FloorPlan");
  console.log(`  ── Grundriss (${floorplans.length}) ${"─".repeat(34)}`);
  if (floorplans.length > 0) {
    const fp = floorplans[0].data;
    const fpRooms = (fp.rooms as unknown[]) ?? [];
    console.log(`  Grundriss „${floorplans[0].id}" mit ${fpRooms.length} Raum/Räumen\n`);
  } else {
    console.log("  (kein Grundriss vorhanden)\n");
  }

  // --- Einstellungen ---
  const settings = findAllRaw("Settings");
  console.log(`  ── Einstellungen (${settings.length}) ${"─".repeat(31)}`);
  if (settings.length > 0) {
    for (const s of settings) {
      console.log(`  ID: ${s.id}`);
    }
    console.log();
  } else {
    console.log("  (keine)\n");
  }

  // --- Module ---
  const modules = findAllRaw("Module");
  console.log(`  ── Module (${modules.length}) ${"─".repeat(37)}`);
  printSection("Module", modules, ["id", "name"]);

  // --- Discovered Devices ---
  const discoveredTypes = [
    "MatterDeviceDiscovered",
    "HueDeviceDiscovered",
    "HueBridgeDiscovered",
    "HueDiscoveredBridge",
    "SonosDeviceDiscovered",
    "HeosDeviceDiscovered",
    "SonoffDeviceDiscovered",
    "XiaomiDeviceDiscovered",
    "LGDeviceDiscovered",
    "BMWDeviceDiscovered",
    "WeatherDeviceDiscovered",
    "CalendarDeviceDiscovered",
    "AppleCalendarDeviceDiscovered",
    "WACLightingDeviceDiscovered",
  ];

  let totalDiscovered = 0;
  const discoveredSummary: string[] = [];
  for (const dt of discoveredTypes) {
    const count = countByType(dt);
    if (count > 0) {
      totalDiscovered += count;
      discoveredSummary.push(`${dt}: ${count}`);
    }
  }

  console.log(`  ── Discovered Devices (${totalDiscovered}) ${"─".repeat(26)}`);
  if (discoveredSummary.length === 0) {
    console.log("  (keine)\n");
  } else {
    for (const line of discoveredSummary) {
      console.log(`  ${line}`);
    }
    console.log();

    for (const dt of discoveredTypes) {
      const rows = findAllRaw(dt);
      if (rows.length === 0) continue;
      console.log(`    ┌ ${dt} (${rows.length})`);
      for (const r of rows) {
        const name = r.data.name ?? r.data.displayName ?? r.data.label ?? "";
        console.log(`    │  ${r.id}  ${name}`);
      }
      console.log(`    └${"─".repeat(40)}\n`);
    }
  }

  // --- ML-Tabellen (separate DB) ---
  console.log(`  ── ML-Tabellen (DataCollector, ${mlDbPath}) ${"─".repeat(5)}`);
  if (mlDb) {
    for (const table of ["ml_events", "ml_snapshots", "l_devices", "l_device_types", "l_rooms", "l_modules", "l_event_types"]) {
      try {
        const exists = mlDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
        if (exists) {
          const cnt = (mlDb.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
          console.log(`  ${table.padEnd(20)} ${cnt} Zeilen`);
        }
      } catch { /* ok */ }
    }
  } else {
    console.log(`  (ML-DB nicht vorhanden)`);
  }
  console.log();

  // --- Zusammenfassung aller DB-Typen ---
  const allTypes = (
    db.prepare("SELECT type, COUNT(*) AS c FROM objects GROUP BY type ORDER BY type").all() as { type: string; c: number }[]
  );
  console.log(`  ── Alle Objekt-Typen in der DB ${"─".repeat(18)}`);
  for (const t of allTypes) {
    console.log(`  ${t.type.padEnd(35)} ${t.c}`);
  }
  console.log();

  // ═══════════════════════════════════════════════════════════════════════════
  db.close();
  mlDb?.close();
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║           Cleanup abgeschlossen              ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log("Beim nächsten Server-Start werden die Presence-Server automatisch wiederhergestellt.");
}

main().catch((err) => {
  console.error("Cleanup fehlgeschlagen:", err);
  try { db.close(); } catch { /* ok */ }
  try { mlDb?.close(); } catch { /* ok */ }
  process.exit(1);
});
