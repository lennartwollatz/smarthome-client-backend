import miio from "miio";
import { logger } from "../../../../logger.js";

type MiioDevice = {
  model?: string;
  name?: string;
  id?: string | number;
  address?: string;
  // Many devices expose methods dynamically.
  [key: string]: unknown;
};

export class XiaomiController {
  private static deviceCache = new Map<string, MiioDevice>();

  static async connect(address: string, token?: string) {
    const cacheKey = `${address}:${token ?? ""}`;
    if (this.deviceCache.has(cacheKey)) {
      return this.deviceCache.get(cacheKey)!;
    }
    try {
      const device = await miio.device({ address, token });
      this.deviceCache.set(cacheKey, device as MiioDevice);
      return device as MiioDevice;
    } catch (err) {
      logger.warn({ err }, "Miio Verbindung fehlgeschlagen für {}", address);
      return null;
    }
  }

  static async destroy(address: string, token?: string) {
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

  static async callMethod(address: string, token: string | undefined, method: string, ...args: unknown[]) {
    const device = await this.connect(address, token);
    if (!device) return false;
    const fn = device[method] as ((...innerArgs: unknown[]) => Promise<unknown>) | undefined;
    if (typeof fn !== "function") {
      logger.warn("Miio Methode {} nicht verfügbar für {}", method, address);
      return false;
    }
    try {
      await fn.apply(device, args);
      return true;
    } catch (err) {
      logger.warn({ err }, "Miio Methode {} fehlgeschlagen für {}", method, address);
      return false;
    }
  }
}

