import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { XiaomiDeviceDiscovered } from "./xiaomiDeviceDiscovered.js";
import { ModuleDeviceDiscover } from "../moduleDeviceDiscover.js";
import miio from "miio";
import { XIAOMICONFIG, XIAOMIMODULE } from "./xiaomiModule.js";

export class XiaomiDeviceDiscover extends ModuleDeviceDiscover<XiaomiDeviceDiscovered> {
  
  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  getModuleName(): string {
    return XIAOMIMODULE.name;
  }

  getDiscoveredDeviceTypeName(): string {
    return XIAOMICONFIG.deviceTypeName;
  }

  public async startDiscovery(timeoutSeconds: number): Promise<XiaomiDeviceDiscovered[]> {
    logger.info("Starte Xiaomi MiIO Discovery via miio");
    const devices: XiaomiDeviceDiscovered[] = [];
    const discovery = miio.browse({ cacheTime: 5 });
    
    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        resolve();
      }, timeoutSeconds * 1000);

      discovery.on("available", (device: Record<string, unknown>) => {
        try {
          const mapped = this.createDeviceFromMiio(device);
          devices.push(mapped);
        } catch (err) {
          logger.warn({ err, device }, "Fehler beim Erstellen des Xiaomi-Geräts");
        }
      });

      discovery.on("error", (err: Error) => {
        logger.warn({ err }, "Miio Discovery Fehler");
      });

      discovery.on("unavailable", () => {
        // ignore
      });
    });

    logger.info({ count: devices.length }, "Xiaomi Discovery beendet");
    return devices;
  }

  public async stopDiscovery(): Promise<void> {
    return;
  }

  private createDeviceFromMiio(dev: Record<string, unknown>): XiaomiDeviceDiscovered {
    const name = getString(dev, "name") ?? getString(dev, "friendlyName") ?? "Xiaomi Device";
    const model = getString(dev, "model");
    const token = getString(dev, "token");
    const ip = getString(dev, "address") ?? getString(dev, "ip");
    const mac = getString(dev, "mac");
    const did = getString(dev, "id");
    const locale = getString(dev, "locale");
    const status = getString(dev, "status");
    const id = buildDeviceId(did, ip, name);
    const address = ip ?? "unknown";
    const port = 54321; // Standard MiIO Port
    
    return new XiaomiDeviceDiscovered(id, name, address, port, model, token, mac, did, locale, status);
  }
}

function getString(obj: Record<string, unknown>, key: string) {
  const value = obj?.[key];
  if (typeof value === "string" && value.length) {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return undefined;
}

function buildDeviceId(did?: string, ip?: string, name?: string) {
  if (did) return `xiaomi-${did}`;
  if (ip) return `xiaomi-${ip}`;
  if (name) return `xiaomi-${name.replace(/\s+/g, "-").toLowerCase()}`;
  return `xiaomi-${cryptoRandom()}`;
}

function cryptoRandom() {
  return Math.random().toString(16).slice(2);
}

