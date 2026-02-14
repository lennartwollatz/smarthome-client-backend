import miio from "miio";
import { logger } from "../../../../logger.js";
import { ModuleDeviceController } from "../moduleDeviceController.js";
import { XiaomiEvent } from "./xiaomiEvent.js";
import { XiaomiVacuumCleaner } from "./devices/xiaomiVacuumCleaner.js";
import { Device } from "../../../../model/devices/Device.js";
import { ModuleDeviceControllerEvent } from "../moduleDeviceControllerEvent.js";

type MiioDevice = {
  model?: string;
  name?: string;
  id?: string | number;
  address?: string;
  // Many devices expose methods dynamically.
  [key: string]: unknown;
};

export class XiaomiDeviceController extends ModuleDeviceControllerEvent<XiaomiEvent, XiaomiVacuumCleaner> {
  private deviceCache = new Map<string, MiioDevice>();
  private eventHandlers = new Map<string, Map<string, (...args: any[]) => void>>();

  async connect(address: string, token?: string): Promise<MiioDevice | null> {
    const cacheKey = `${address}:${token ?? ""}`;
    if (this.deviceCache.has(cacheKey)) {
      return this.deviceCache.get(cacheKey)!;
    }
    try {
      const device = await miio.device({ address, token });
      this.deviceCache.set(cacheKey, device as MiioDevice);
      return device as MiioDevice;
    } catch (err) {
      logger.warn({ err, address }, "Miio Verbindung fehlgeschlagen");
      return null;
    }
  }

  async destroy(address: string, token?: string): Promise<void> {
    const cacheKey = `${address}:${token ?? ""}`;
    const device = this.deviceCache.get(cacheKey);
    if (device && typeof device.destroy === "function") {
      try {
        await (device.destroy as () => Promise<void>)();
      } catch (err) {
        logger.debug({ err }, "Miio destroy fehlgeschlagen");
      }
    }
    this.deviceCache.delete(cacheKey);
  }

  async callMethod(address: string, token: string | undefined, method: string, ...args: unknown[]): Promise<boolean> {
    const device = await this.connect(address, token);
    if (!device) return false;
    const fn = device[method] as ((...innerArgs: unknown[]) => Promise<unknown>) | undefined;
    if (typeof fn !== "function") {
      logger.warn({ method, address }, "Miio Methode nicht verfügbar");
      return false;
    }
    try {
      await fn.apply(device, args);
      return true;
    } catch (err) {
      logger.warn({ err, method, address }, "Miio Methode fehlgeschlagen");
      return false;
    }
  }

  public async startEventStream(device: XiaomiVacuumCleaner, callback: (event: XiaomiEvent) => void): Promise<void> {
    const deviceId = device.id ?? "";
    if (!deviceId) {
      throw new Error("Device ID ist erforderlich für EventStreamListener");
    }
    
    const address = device.getAddress();
    const token = device.getToken();
    
    if (!address || !token) {
      logger.warn({ deviceId }, "Address oder Token fehlen für EventStream");
      return;
    }

    try {
      const miioDevice = await this.connect(address, token);
      if (!miioDevice) {
        logger.warn({ deviceId, address }, "Konnte keine Verbindung zum Gerät herstellen");
        return;
      }

      // MiIO-Geräte unterstützen normalerweise keine Event-Streams wie Sonos
      // Hier können wir Polling implementieren oder auf spezifische Events warten
      // Für jetzt implementieren wir eine Basis-Version
      logger.debug({ deviceId }, "EventStream für Xiaomi-Gerät gestartet (Polling-Modus)");
      
      // TODO: Implementiere Event-Stream basierend auf MiIO-Protokoll
      // MiIO unterstützt keine nativen Event-Streams, daher müsste hier Polling implementiert werden
      
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Starten des EventStreamListeners");
      throw err;
    }
  }

  public async stopEventStream(device: XiaomiVacuumCleaner): Promise<void> {
    const deviceId = device.id ?? "";
    if (!deviceId) {
      return;
    }
    
    const handlers = this.eventHandlers.get(deviceId);
    if (handlers) {
      handlers.clear();
      this.eventHandlers.delete(deviceId);
      logger.debug({ deviceId }, "EventStreamListener entfernt");
    }
  }
}

