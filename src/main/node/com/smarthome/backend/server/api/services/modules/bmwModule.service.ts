import { Router } from "express";
import { logger } from "../../../../logger.js";
import { BMWModuleManager } from "../../modules/bmw/bmwModuleManager.js";
import {
  BMW_TANK_CAPACITY_MIN_LITERS,
  BMW_TANK_CAPACITY_MAX_LITERS
} from "../../modules/bmw/bmwCarFuelSettingsStore.js";
import type { ServerDeps } from "../../server.js";
import { serializeDevicesForApi } from "../../entities/devices/deviceSerialize.js";

export function createBMWModuleRouter(deps: ServerDeps) {
  const router = Router();
  const bmwModule = new BMWModuleManager(
    deps.databaseManager,
    deps.deviceManager,
    deps.eventManager,
    deps.eventLogStore
  );
  deps.deviceManager.registerModuleManager(bmwModule);

  router.get("/credentials", (_req, res) => {
    res.status(200).json(bmwModule.getCredentialsInfo());
  });

  router.put("/credentials", (req, res) => {
    const body = req.body ?? {};
    const clientIdRaw = body.clientId;
    const mqttHostRaw = body.mqttHost;
    const mqttPortRaw = body.mqttPort;
    const clientId = typeof clientIdRaw === "string" ? clientIdRaw.trim() : "";
    if (!clientId) {
      res.status(400).json({ error: "clientId ist erforderlich" });
      return;
    }
    const mqttHost = typeof mqttHostRaw === "string" && mqttHostRaw.trim() ? mqttHostRaw.trim() : undefined;
    const mqttPort =
      typeof mqttPortRaw === "number"
        ? mqttPortRaw
        : typeof mqttPortRaw === "string" && mqttPortRaw.trim()
          ? Number(mqttPortRaw)
          : undefined;
    bmwModule.setCarDataConfig(clientId, mqttHost, Number.isFinite(mqttPort as number) ? (mqttPort as number) : undefined);
    res.status(200).json(bmwModule.getCredentialsInfo());
  });

  router.post("/auth/device-code", async (_req, res) => {
    try {
      const start = await bmwModule.startDeviceCodeFlow();
      res.status(200).json({
        user_code: start.user_code,
        verification_uri: start.verification_uri,
        verification_uri_complete: start.verification_uri_complete,
        expires_in: start.expires_in,
        interval: start.interval
      });
    } catch (err: any) {
      logger.error({ err }, "BMW Device Code Start fehlgeschlagen");
      res.status(400).json({ error: err?.message ?? "Device Code Start fehlgeschlagen" });
    }
  });

  router.post("/auth/poll", async (_req, res) => {
    try {
      const result = await bmwModule.pollDeviceTokenOnce();
      res.status(200).json({ ...result, credentials: bmwModule.getCredentialsInfo() });
    } catch (err: any) {
      logger.error({ err }, "BMW Token Poll fehlgeschlagen");
      res.status(500).json({ error: err?.message ?? "Poll fehlgeschlagen" });
    }
  });

  router.post("/auth/clear", (_req, res) => {
    bmwModule.clearTokens();
    res.status(200).json(bmwModule.getCredentialsInfo());
  });

  router.get("/devices/discover", async (_req, res) => {
    try {
      const creds = bmwModule.getCredentialsInfo();
      if (!creds.canDiscover) {
        res.status(400).json({
          error: "Discovery nicht moeglich: Client-ID speichern und bei BMW anmelden (gueltige Token).",
          credentials: creds
        });
        return;
      }
      const devices = await bmwModule.discoverDevices();
      res.status(200).json(serializeDevicesForApi(devices));
    } catch (error) {
      logger.error({ error }, "Fehler beim Discover von BMW Fahrzeugen");
      res.status(500).json({ error: "Fehler beim Discover von BMW Fahrzeugen" });
    }
  });

  router.get("/devices/:deviceId/telemetry/keys", (req, res) => {
    const deviceId = req.params.deviceId;
    const device = deps.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== "bmw") {
      res.status(404).json({ error: "BMW-Fahrzeug nicht gefunden" });
      return;
    }
    res.status(200).json(bmwModule.getTelemetryKeys());
  });

  router.get("/devices/:deviceId/trips/available-months", (req, res) => {
    const deviceId = req.params.deviceId;
    const result = bmwModule.getAvailableTripMonths(deviceId);
    if (!result) {
      res.status(404).json({ error: "BMW-Fahrzeug nicht gefunden" });
      return;
    }
    res.status(200).json(result);
  });

  router.get("/devices/:deviceId/trips", async (req, res) => {
    const deviceId = req.params.deviceId;
    const fromRaw = req.query.from;
    const toRaw = req.query.to;
    const fromMs = typeof fromRaw === "string" ? Number(fromRaw) : NaN;
    const toMs = typeof toRaw === "string" ? Number(toRaw) : NaN;
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      res.status(400).json({ error: "from und to (Unix-ms) sind erforderlich" });
      return;
    }
    try {
      const result = await bmwModule.getTrips(deviceId, { fromMs, toMs });
      if (!result) {
        res.status(404).json({ error: "BMW-Fahrzeug nicht gefunden" });
        return;
      }
      res.status(200).json(result);
    } catch (err) {
      logger.error({ err, deviceId }, "BMW getTrips fehlgeschlagen");
      res.status(500).json({ error: "Fahrten konnten nicht geladen werden" });
    }
  });

  router.get("/devices/:deviceId/telemetry/history", (req, res) => {
    const deviceId = req.params.deviceId;
    const fromRaw = req.query.from;
    const toRaw = req.query.to;
    const keysRaw = req.query.keys;
    const fromMs = typeof fromRaw === "string" ? Number(fromRaw) : NaN;
    const toMs = typeof toRaw === "string" ? Number(toRaw) : NaN;
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      res.status(400).json({ error: "from und to (Unix-ms) sind erforderlich" });
      return;
    }
    const keys =
      typeof keysRaw === "string" && keysRaw.trim()
        ? keysRaw.split(",").map(k => k.trim()).filter(Boolean)
        : undefined;
    const result = bmwModule.getTelemetryHistory(deviceId, { fromMs, toMs, keys });
    if (!result) {
      res.status(404).json({ error: "BMW-Fahrzeug nicht gefunden" });
      return;
    }
    res.status(200).json(result);
  });

  router.get("/vehicle-names", (_req, res) => {
    res.status(200).json({ names: bmwModule.getVehicleNames() });
  });

  router.put("/vehicles/:vin/name", async (req, res) => {
    const vin = typeof req.params.vin === "string" ? req.params.vin.trim() : "";
    const nameRaw = req.body?.name;
    const name = typeof nameRaw === "string" ? nameRaw : "";
    if (!vin) {
      res.status(400).json({ error: "VIN ist erforderlich" });
      return;
    }
    const car = await bmwModule.setVehicleName(vin, name);
    if (!car) {
      res.status(404).json({ error: "Fahrzeug mit dieser VIN wurde noch nicht angelegt (Discovery ausführen)." });
      return;
    }
    res.status(200).json({ success: true, device: serializeDevicesForApi([car])[0] });
  });

  router.put("/devices/:deviceId/trips/:entryId/category", (req, res) => {
    const deviceId = req.params.deviceId;
    const entryId = req.params.entryId;
    const categoryRaw = req.body?.category;
    const category =
      categoryRaw === null || categoryRaw === ""
        ? null
        : typeof categoryRaw === "string"
          ? categoryRaw
          : undefined;
    if (category !== null && category !== "private" && category !== "business") {
      res.status(400).json({ error: "category muss 'private', 'business' oder null sein" });
      return;
    }
    const result = bmwModule.setTripCategory(deviceId, entryId, category);
    if (!result) {
      res.status(404).json({ error: "BMW-Fahrzeug nicht gefunden" });
      return;
    }
    if (!result.success) {
      res.status(400).json({ error: "Kategorie konnte nicht gespeichert werden" });
      return;
    }
    res.status(200).json(result);
  });

  router.get("/devices/:deviceId/trips/year-summary", (req, res) => {
    const deviceId = req.params.deviceId;
    const yearRaw = req.query.year;
    const year =
      typeof yearRaw === "string" && yearRaw.trim() !== "" ? Number(yearRaw) : undefined;
    if (year != null && !Number.isFinite(year)) {
      res.status(400).json({ error: "year muss eine Zahl sein" });
      return;
    }
    const summary = bmwModule.getTripYearSummary(deviceId, year);
    if (!summary) {
      res.status(404).json({ error: "BMW-Fahrzeug nicht gefunden" });
      return;
    }
    res.status(200).json(summary);
  });

  router.get("/devices/:deviceId/trip-categories", (req, res) => {
    const deviceId = req.params.deviceId;
    const categories = bmwModule.getTripCategories(deviceId);
    if (!categories) {
      res.status(404).json({ error: "BMW-Fahrzeug nicht gefunden" });
      return;
    }
    res.status(200).json({ categories });
  });

  router.get("/devices/:deviceId/home", (req, res) => {
    const deviceId = req.params.deviceId;
    const device = deps.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== "bmw") {
      res.status(404).json({ error: "BMW-Fahrzeug nicht gefunden" });
      return;
    }
    res.status(200).json({ home: bmwModule.getHome(deviceId) });
  });

  router.put("/devices/:deviceId/home", (req, res) => {
    const deviceId = req.params.deviceId;
    const body = req.body ?? {};
    const lat = typeof body.latitude === "number" ? body.latitude : Number(body.latitude);
    const lng = typeof body.longitude === "number" ? body.longitude : Number(body.longitude);
    const label = typeof body.label === "string" ? body.label : undefined;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: "latitude und longitude (Zahlen) sind erforderlich" });
      return;
    }
    const home = bmwModule.setHome(deviceId, lat, lng, label);
    if (!home) {
      res.status(404).json({ error: "BMW-Fahrzeug nicht gefunden oder ungültige Koordinaten" });
      return;
    }
    res.status(200).json({ home });
  });

  router.delete("/devices/:deviceId/home", (req, res) => {
    const deviceId = req.params.deviceId;
    const ok = bmwModule.clearHome(deviceId);
    if (!ok) {
      res.status(404).json({ error: "BMW-Fahrzeug nicht gefunden" });
      return;
    }
    res.status(200).json({ success: true });
  });

  router.get("/devices/:deviceId/learned-places", (req, res) => {
    const deviceId = req.params.deviceId;
    const places = bmwModule.getLearnedPlaces(deviceId);
    if (places == null) {
      res.status(404).json({ error: "BMW-Fahrzeug nicht gefunden" });
      return;
    }
    res.status(200).json({ places });
  });

  router.delete("/devices/:deviceId/learned-places/:placeId", (req, res) => {
    const deviceId = req.params.deviceId;
    const placeId = req.params.placeId;
    if (!placeId) {
      res.status(400).json({ error: "placeId erforderlich" });
      return;
    }
    const ok = bmwModule.deleteLearnedPlace(deviceId, placeId);
    if (!ok) {
      res.status(404).json({ error: "Ort oder Fahrzeug nicht gefunden" });
      return;
    }
    res.status(200).json({ success: true });
  });

  router.get("/devices/:deviceId/fuel-settings", (req, res) => {
    const deviceId = req.params.deviceId;
    const settings = bmwModule.getFuelSettings(deviceId);
    if (!settings) {
      res.status(404).json({ error: "BMW-Fahrzeug nicht gefunden" });
      return;
    }
    res.status(200).json({
      settings,
      limits: {
        minLiters: BMW_TANK_CAPACITY_MIN_LITERS,
        maxLiters: BMW_TANK_CAPACITY_MAX_LITERS
      }
    });
  });

  router.put("/devices/:deviceId/fuel-settings", (req, res) => {
    const deviceId = req.params.deviceId;
    const body = req.body ?? {};
    const liters =
      typeof body.tankCapacityLiters === "number"
        ? body.tankCapacityLiters
        : Number(body.tankCapacityLiters);
    if (!Number.isFinite(liters)) {
      res.status(400).json({ error: "tankCapacityLiters muss eine Zahl sein" });
      return;
    }
    const result = bmwModule.setFuelSettings(deviceId, liters);
    if (!result.ok) {
      if (result.reason === "device-not-found") {
        res.status(404).json({ error: "BMW-Fahrzeug nicht gefunden" });
      } else {
        res.status(400).json({
          error: `Tankvolumen muss zwischen ${BMW_TANK_CAPACITY_MIN_LITERS} und ${BMW_TANK_CAPACITY_MAX_LITERS} Litern liegen`
        });
      }
      return;
    }
    res.status(200).json({ settings: result.settings });
  });

  router.delete("/devices/:deviceId/fuel-settings", (req, res) => {
    const deviceId = req.params.deviceId;
    const settings = bmwModule.resetFuelSettings(deviceId);
    if (!settings) {
      res.status(404).json({ error: "BMW-Fahrzeug nicht gefunden" });
      return;
    }
    res.status(200).json({ settings });
  });

  router.post("/devices/:deviceId/refresh", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Ungueltige Device ID" });
      return;
    }
    const success = await bmwModule.refreshDevice(deviceId);
    res.status(success ? 200 : 404).json(success ? { success: true } : { error: "Fahrzeug nicht gefunden" });
  });

  return router;
}
