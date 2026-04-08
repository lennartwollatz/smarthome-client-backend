import { Router } from "express";
import { logger } from "../../../../logger.js";
import type { ServerDeps } from "../../server.js";
import { SonoffModuleManager } from "../../modules/sonoff/sonoffModuleManager.js";
import type { SonoffDeviceDiscovered } from "../../modules/sonoff/sonoffDeviceDiscovered.js";

/** API-Antwort ohne LAN-API-Key; `canPairWithStoredKey` zeigt an, ob das Backend nach der Suche per Geräte-ID pairen kann. */
export function sonoffDiscoveredToDto(device: SonoffDeviceDiscovered) {
  const key = device.apiKey?.trim();
  return {
    id: device.id,
    name: device.name,
    address: device.address,
    port: device.port,
    ewelinkDeviceId: device.ewelinkDeviceId,
    vendorId: device.vendorId,
    productId: device.productId,
    brandName: device.brandName,
    productModel: device.productModel,
    ewelinkModelInfo: device.ewelinkModelInfo,
    ewelinkMac: device.ewelinkMac,
    isPaired: device.isPaired,
    canPairWithStoredKey: !!key,
    pairedAt: device.pairedAt,
    txtRecord: device.txtRecord,
  };
}

export function createSonoffModuleRouter(deps: ServerDeps) {
  const router = Router();
  const sonoffModule = new SonoffModuleManager(deps.databaseManager, deps.deviceManager, deps.eventManager);
  deps.deviceManager.registerModuleManager(sonoffModule);

  router.get("/devices/discover", async (_req, res) => {
    try {
      const { devices, authorizationKey } = await sonoffModule.discoverDevices();
      res.status(200).json({ devices: devices.map(sonoffDiscoveredToDto), authorizationKey });
    } catch (error) {
      logger.error({ error }, "Fehler beim Discover von Sonoff-Geraeten");
      res.status(500).json({ error: "Fehler beim Discover von Sonoff-Geraeten" });
    }
  });

  /** Discover mit eWeLink-Zugangsdaten im Body (`email`/`username`, `password`, `countryCode`). */
  router.post("/devices/discover", async (req, res) => {
    try {
      const body = req.body ?? {};
      const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
      const email = typeof record.email === "string" ? record.email.trim() : "";
      const username = typeof record.username === "string" ? record.username.trim() : "";
      const user = email || username || undefined;
      const password = typeof record.password === "string" && record.password.length > 0 ? record.password : undefined;
      const ccRaw =
        typeof record.countryCode === "string" && record.countryCode.trim().length > 0
          ? record.countryCode.trim()
          : undefined;

      const { devices, authorizationKey } = await sonoffModule.discoverDevicesWithEwelinkInput({
        user,
        password,
        countryCode: ccRaw,
      });
      res.status(200).json({ devices: devices.map(sonoffDiscoveredToDto), authorizationKey });
    } catch (error) {
      logger.error({ error }, "Fehler beim Discover von Sonoff-Geraeten (POST)");
      res.status(500).json({ error: "Fehler beim Discover von Sonoff-Geraeten" });
    }
  });

  router.post("/devices/:deviceId/pair", async (req, res) => {
    try {
      const result = await sonoffModule.pairDevice(req.params.deviceId);
      res.status(result.success ? 200 : 404).json(
        result.success
          ? { success: true, device: result.device }
          : { success: false, error: result.error ?? "Gerät nicht gefunden oder Pairing fehlgeschlagen" }
      );
    } catch (error) {
      logger.error({ error }, "Fehler beim Pairing des Sonoff-Geraets");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/:buttonId/toggle", async (req, res) => {
    try {
      const result = await sonoffModule.toggle(req.params.deviceId, req.params.buttonId);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Toggle eines Sonoff-Buttons");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/:buttonId/setOn", async (req, res) => {
    try {
      const result = await sonoffModule.setOn(req.params.deviceId, req.params.buttonId);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen des On-Zustands (Sonoff)");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/:buttonId/setOff", async (req, res) => {
    try {
      const result = await sonoffModule.setOff(req.params.deviceId, req.params.buttonId);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen des Off-Zustands (Sonoff)");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  router.post("/devices/:deviceId/:buttonId/setIntensity", async (req, res) => {
    try {
      const result = await sonoffModule.setIntensity(req.params.deviceId, req.params.buttonId, req.body.intensity ?? 0);
      res.status(result ? 200 : 400).json(result ? { success: true } : { success: false });
    } catch (error) {
      logger.error({ error }, "Fehler beim Setzen der Intensität (Sonoff)");
      res.status(400).json({ error: "Invalid request" });
    }
  });

  return router;
}
