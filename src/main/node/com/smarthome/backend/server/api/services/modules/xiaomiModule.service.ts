import { Router } from "express";
import { logger } from "../../../../logger.js";
import type { ServerDeps } from "../../server.js";
import { XiaomiModuleManager, type StartCleaningRoomOptions } from "../../modules/xiaomi/xiaomiModuleManager.js";

function parseStartCleaningRoomOptions(body: Record<string, unknown>): StartCleaningRoomOptions | undefined {
  const out: StartCleaningRoomOptions = {};
  const cm = body["cleaningMode"];
  if (cm !== undefined && cm !== null && `${cm}` !== "") {
    const n = typeof cm === "number" ? cm : Number(cm);
    if (Number.isFinite(n)) {
      const m = Math.round(n);
      if (m === 1 || m === 2 || m === 3) out.cleaningMode = m;
    }
  }
  const vi = body["vacuumIntensity"];
  if (vi !== undefined && vi !== null && `${vi}` !== "") {
    const n = typeof vi === "number" ? vi : Number(vi);
    if (Number.isFinite(n)) out.vacuumIntensity = Math.max(0, Math.min(4, Math.round(n)));
  }
  const wi = body["wiperIntensity"];
  if (typeof wi === "string" && wi.trim() !== "") out.wiperIntensity = wi.trim();
  const rt = body["repeatTimes"];
  if (rt !== undefined && rt !== null && `${rt}` !== "") {
    const n = typeof rt === "number" ? rt : Number(rt);
    if (Number.isFinite(n)) out.repeatTimes = Math.max(1, Math.min(3, Math.round(n)));
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseCleanSequenceBody(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const el of raw) {
    if (typeof el === "string" && el.trim() !== "") {
      out.push(el.trim());
    } else if (typeof el === "number" && Number.isFinite(el)) {
      out.push(String(Math.round(el)));
    } else {
      return null;
    }
  }
  return out;
}

export function createXiaomiModuleRouter(deps: ServerDeps) {
  const router = Router();
  const xiaomiModule = new XiaomiModuleManager(
    deps.databaseManager,
    deps.deviceManager,
    deps.eventManager
  );
  deps.deviceManager.registerModuleManager(xiaomiModule);

  // Discovery: Liefert gefundene Xiaomi-Staubsauger zurück
  router.get("/devices/discover", async (_req, res) => {
    try {
      const devices = await xiaomiModule.discoverDevices();
      res.status(200).json(devices);
    } catch (error) {
      logger.error({ error }, "Fehler beim Discover von Xiaomi-Geraeten");
      res.status(500).json({ error: "Fehler beim Discover von Xiaomi-Geraeten" });
    }
  });

  // Manuelles Hinzufügen per IP und Token (nur bei erfolgreichem miio-Pairing)
  router.post("/devices/add", async (req, res) => {
    const { ipAddress, token } = req.body ?? {};
    if (!ipAddress || !token) {
      res.status(400).json({
        error: "IP-Adresse und Token sind erforderlich",
        details: "Bitte gib ipAddress und token im Request-Body an."
      });
      return;
    }
    try {
      const device = await xiaomiModule.addDeviceByIpAndToken(
        String(ipAddress).trim(),
        String(token).trim()
      );
      res.status(201).json(device);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fehler beim Hinzufuegen des Geraets";
      logger.error({ error }, "Fehler beim manuellen Hinzufuegen eines Xiaomi-Geraets");
      res.status(400).json({ error: message });
    }
  });

  // Staubsauger starten
  router.post("/devices/:deviceId/startCleaning", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const success = await xiaomiModule.startCleaning(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler beim Starten der Reinigung");
      res.status(500).json({ error: "Fehler beim Starten der Reinigung" });
    }
  });

  // Reinigung pausieren / fortsetzen
  router.post("/devices/:deviceId/pauseCleaning", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const success = await xiaomiModule.pauseCleaning(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler beim Pausieren der Reinigung");
      res.status(500).json({ error: "Fehler beim Pausieren der Reinigung" });
    }
  });

  router.post("/devices/:deviceId/resumeCleaning", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const success = await xiaomiModule.resumeCleaning(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler beim Fortsetzen der Reinigung");
      res.status(500).json({ error: "Fehler beim Fortsetzen der Reinigung" });
    }
  });

  /**
   * Body: { cleaningMode?, vacuumIntensity?, wiperIntensity?, repeatTimes? } — mindestens ein Feld.
   * Wird sofort am Staubsauger ausgeführt (z. B. während laufender Reinigung), ohne Segment-Start.
   */
  router.post("/devices/:deviceId/applyCleaningRoomOptions", async (req, res) => {
    const deviceId = req.params.deviceId;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    const optionPatch = parseStartCleaningRoomOptions(body);
    if (optionPatch == null) {
      res.status(400).json({ error: "Mindestens eine gueltige Option (cleaningMode, vacuumIntensity, wiperIntensity, repeatTimes) ist erforderlich" });
      return;
    }
    try {
      const success = await xiaomiModule.applyCleaningRoomOptions(deviceId, optionPatch);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler beim Anwenden der Reinigungsoptionen");
      res.status(500).json({ error: "Fehler beim Anwenden der Reinigungsoptionen" });
    }
  });

  /**
   * Body: { roomIds: string[], cleaningMode?, vacuumIntensity?, wiperIntensity?, repeatTimes? }
   * Optionale Parameter werden am Gerät und im Persistenz-Store gesetzt, danach Raumreinigung.
   */
  router.post("/devices/:deviceId/startCleaningRoom", async (req, res) => {
    const deviceId = req.params.deviceId;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const roomIds = body["roomIds"];
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    const ids = Array.isArray(roomIds) ? roomIds.map((x: unknown) => String(x)) : [];
    if (ids.length === 0) {
      res.status(400).json({ error: "roomIds (nicht-leeres Array) ist erforderlich" });
      return;
    }
    const optionPatch = parseStartCleaningRoomOptions(body);
    try {
      const success = await xiaomiModule.startCleaningRoom(deviceId, ids, optionPatch);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler beim Starten der Raumreinigung");
      res.status(500).json({ error: "Fehler beim Starten der Raumreinigung" });
    }
  });

  // Staubsauger stoppen
  router.post("/devices/:deviceId/stopCleaning", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const success = await xiaomiModule.stopCleaning(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler beim Stoppen der Reinigung");
      res.status(500).json({ error: "Fehler beim Stoppen der Reinigung" });
    }
  });

  // Staubsauger zur Docking-Station schicken
  router.post("/devices/:deviceId/dock", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const success = await xiaomiModule.dock(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler beim Senden zur Docking-Station");
      res.status(500).json({ error: "Fehler beim Senden zur Docking-Station" });
    }
  });

  // Find me (akustisches Signal am Gerät, z. B. MiIO find_me)
  router.post("/devices/:deviceId/findMe", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const success = await xiaomiModule.findMe(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler bei findMe");
      res.status(500).json({ error: "Fehler bei findMe" });
    }
  });

  /** Body: { cleanSequence: string[] | number[] } — wird mit {@link XiaomiModuleManager.setCleanSequenceForDevice} gesetzt. */
  router.post("/devices/:deviceId/setCleanSequence", async (req, res) => {
    const deviceId = req.params.deviceId;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    const seq = parseCleanSequenceBody(body["cleanSequence"]);
    if (seq === null) {
      res.status(400).json({ error: "cleanSequence muss ein Array von Raum-IDs (Zahl oder String) sein" });
      return;
    }
    try {
      const updated = await xiaomiModule.setCleanSequenceForDevice(deviceId, seq);
      if (!updated) {
        res.status(404).json({ error: "Geraet nicht gefunden" });
        return;
      }
      res.status(200).json({ success: true, device: updated });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler bei setCleanSequence");
      res.status(500).json({ error: "Fehler bei setCleanSequence" });
    }
  });

  router.post("/devices/:deviceId/startWash", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const success = await xiaomiModule.startWash(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler bei startWash");
      res.status(500).json({ error: "Fehler bei startWash" });
    }
  });

  router.post("/devices/:deviceId/stopWash", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const success = await xiaomiModule.stopWash(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler bei stopWash");
      res.status(500).json({ error: "Fehler bei stopWash" });
    }
  });

  router.post("/devices/:deviceId/startDustCollection", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const success = await xiaomiModule.startDustCollection(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler bei startDustCollection");
      res.status(500).json({ error: "Fehler bei startDustCollection" });
    }
  });

  router.post("/devices/:deviceId/stopDustCollection", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const success = await xiaomiModule.stopDustCollection(deviceId);
      res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Geraet nicht gefunden" });
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler bei stopDustCollection");
      res.status(500).json({ error: "Fehler bei stopDustCollection" });
    }
  });

  // Raum-Mapping abfragen
  router.get("/devices/:deviceId/roomMapping", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    try {
      const rooms = await xiaomiModule.getRoomMapping(deviceId);
      res.status(200).json(rooms);
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler beim Abrufen des Raum-Mappings");
      res.status(500).json({ error: "Fehler beim Abrufen des Raum-Mappings" });
    }
  });

  // Staubsauger zu Raum navigieren (für Raumzuordnung)
  router.post("/devices/:deviceId/navigateToRoom", async (req, res) => {
    const deviceId = req.params.deviceId;
    const { roomId } = req.body ?? {};
    if (!deviceId || roomId === undefined || roomId === null) {
      res.status(400).json({ error: "deviceId und roomId sind erforderlich" });
      return;
    }
    try {
      const result = await xiaomiModule.navigateToRoom(deviceId, Number(roomId));
      res.status(200).json(result);
    } catch (error) {
      logger.error({ error, deviceId }, "Fehler beim Navigieren zum Raum");
      res.status(500).json({ error: "Fehler beim Navigieren zum Raum" });
    }
  });

  return router;
}

