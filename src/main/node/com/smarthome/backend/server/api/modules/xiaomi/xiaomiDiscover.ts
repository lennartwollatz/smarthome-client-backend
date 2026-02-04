import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import { XiaomiDiscoveredDevice } from "./xiaomiDiscoveredDevice.js";
import miio from "miio";

export class XiaomiDiscover {
  private repository: JsonRepository<XiaomiDiscoveredDevice>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new JsonRepository<XiaomiDiscoveredDevice>(databaseManager, "XiaomiDiscoveredDevice");
  }

  async discover(username: string, password: string) {
    logger.info("Starte Xiaomi MiIO Discovery via miio");
    if (username || password) {
      logger.debug("Xiaomi Discovery nutzt lokale miio-Discovery; Cloud-Login wird ignoriert");
    }
    const devices = new Set<XiaomiDiscoveredDevice>();
    const discovery = miio.browse({ cacheTime: 5 });
    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        //discovery.destroy();
        resolve();
      }, 5000);

      discovery.on("available", (device: Record<string, unknown>) => {
        console.log(device);
        const mapped = this.createDeviceFromMiio(device);
        devices.add(mapped);
        if (mapped.id) {
          this.repository.save(mapped.id, mapped);
        }
      });

      discovery.on("error", (err: Error) => {
        logger.warn({ err }, "Miio Discovery Fehler");
      });

      discovery.on("unavailable", () => {
        // ignore
      });
    });

    console.log("Xiaomi Discovery beendet: "+ devices.size + " Geraete gefunden");
    return devices;
  }

  private createDeviceFromMiio(dev: Record<string, unknown>) {
    const name = getString(dev, "name") ?? getString(dev, "friendlyName");
    const model = getString(dev, "model");
    const token = getString(dev, "token");
    const ip = getString(dev, "address") ?? getString(dev, "ip");
    const mac = getString(dev, "mac");
    const did = getString(dev, "id");
    const locale = getString(dev, "locale");
    const status = getString(dev, "status");
    const id = buildDeviceId(did, ip, name);
    return new XiaomiDiscoveredDevice(id, name, model, token, ip, mac, did, locale, status);
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

