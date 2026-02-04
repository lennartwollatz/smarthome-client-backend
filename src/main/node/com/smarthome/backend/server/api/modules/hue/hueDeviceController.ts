import { Agent } from "undici";
import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import type { HueDiscoveredBridge } from "./hueDiscoveredBridge.js";

type HueDeviceRecord = Record<string, unknown> & {
  id?: string;
  bridgeId?: string;
  hueResourceId?: string;
  motionRid?: string;
  lightLevelRid?: string;
  temperatureRid?: string;
  batteryRid?: string;
  moduleId?: string;
};

type MotionStatus = {
  motion?: boolean;
  lastChanged?: string;
};

type HueResource = Record<string, unknown> & { id?: string };

export class HueDeviceController {
  private bridgeRepository?: JsonRepository<HueDiscoveredBridge>;
  private deviceRepository?: JsonRepository<HueDeviceRecord>;
  private bridgeCache = new Map<string, HueDiscoveredBridge>();
  private rateWindowStartMillis = 0;
  private requestsInCurrentWindow = 0;
  private rateLimitLock = false;

  constructor(databaseManager?: DatabaseManager) {
    if (databaseManager) {
      this.bridgeRepository = new JsonRepository<HueDiscoveredBridge>(databaseManager, "HueDiscoveredBridge");
      this.deviceRepository = new JsonRepository<HueDeviceRecord>(databaseManager, "Device");
    }
  }

  private async acquireRequestPermit() {
    while (true) {
      let waitTimeMillis = 0;
      if (!this.rateLimitLock) {
        this.rateLimitLock = true;
        const now = Date.now();
        if (now - this.rateWindowStartMillis >= 1000) {
          this.rateWindowStartMillis = now;
          this.requestsInCurrentWindow = 0;
        }
        if (this.requestsInCurrentWindow < 5) {
          this.requestsInCurrentWindow += 1;
          this.rateLimitLock = false;
          return;
        }
        waitTimeMillis = 1000 - (now - this.rateWindowStartMillis);
        if (waitTimeMillis <= 0) {
          this.rateWindowStartMillis = now;
          this.requestsInCurrentWindow = 1;
          this.rateLimitLock = false;
          return;
        }
        this.rateLimitLock = false;
      }
      await sleep(waitTimeMillis);
    }
  }

  private async getBridge(bridgeId: string) {
    const cached = this.bridgeCache.get(bridgeId);
    if (cached) return cached;
    if (!this.bridgeRepository) {
      throw new Error("DatabaseManager nicht initialisiert");
    }
    const bridge = this.bridgeRepository.findById(bridgeId);
    if (!bridge) {
      throw new Error(`Bridge mit ID '${bridgeId}' nicht gefunden`);
    }
    if (!bridge.isPaired || !bridge.username) {
      throw new Error(`Bridge '${bridgeId}' ist nicht gepaart`);
    }
    this.bridgeCache.set(bridgeId, bridge);
    return bridge;
  }

  invalidateBridgeCache(bridgeId: string) {
    this.bridgeCache.delete(bridgeId);
    logger.debug({ bridgeId }, "Bridge-Cache invalidiert");
  }

  clearBridgeCache() {
    this.bridgeCache.clear();
    logger.debug("Bridge-Cache geleert");
  }

  private async request(
    bridgeId: string,
    method: "GET" | "PUT",
    resourcePath: string,
    data?: Record<string, unknown>
  ) {
    const bridge = await this.getBridge(bridgeId);
    await this.acquireRequestPermit();
    const address = bridge.ipAddress;
    const port = 443;
    const httpsDispatcher = new Agent({ connect: { rejectUnauthorized: false } });
    const url = `https://${address}/clip/v2/resource/${resourcePath}`;
    let requestOptions:any = {
      method,
      headers: {
        "Content-Type": "application/json",
        "hue-application-key": bridge.username ?? ""
      },
      dispatcher: httpsDispatcher
    };
    if( data){
      requestOptions = {
        ...requestOptions,
        body: JSON.stringify(data)
      };
    }
    let response: Response;
    try {
      response = await fetch(url, requestOptions);
    } catch (err) {
      logger.error({ err, url }, "HTTP Request zu Hue Bridge fehlgeschlagen");
      throw err;
    }
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    if (!text) return null;
    return JSON.parse(text) as { data?: HueResource[]; errors?: unknown[] };
  }

  async updateResource(
    bridgeId: string,
    resourceType: string,
    resourceId: string,
    data: Record<string, unknown>
  ) {
    const response = await this.request(bridgeId, "PUT", `${resourceType}/${resourceId}`, data);
    const item = response?.data?.[0];
    if (!item) {
      throw new Error("Keine Daten in der Response");
    }
    return item;
  }

  async fetchAllResources(bridgeId: string, resourceType: string) {
    const response = await this.request(bridgeId, "GET", resourceType);
    return response?.data ?? [];
  }

  async fetchAllResourcesAll(bridgeId: string) {
    const response = await this.request(bridgeId, "GET", "device");
    return response?.data ?? [];
  }

  async fetchSingleResource(bridgeId: string, resourceType: string, resourceId: string) {
    const resources = await this.fetchAllResources(bridgeId, `${resourceType}/${resourceId}`);
    return resources[0] ?? null;
  }

  async getBattery(bridgeId: string, batteryRid: string | undefined | null) {
    if (!batteryRid) return null;
    try {
      const resource = await this.fetchSingleResource(bridgeId, "device_power", batteryRid);
      const powerState = (resource?.power_state as Record<string, unknown> | undefined) ?? {};
      const batteryLevel = powerState.battery_level as number | undefined;
      return typeof batteryLevel === "number" ? batteryLevel : null;
    } catch (err) {
      logger.error({ err }, "Fehler beim Abrufen des Batteriestatus");
      return null;
    }
  }

  async getTemperature(bridgeId: string, resourceId: string) {
    try {
      const resource = await this.fetchSingleResource(bridgeId, "temperature", resourceId);
      const report = (resource?.temperature as Record<string, unknown> | undefined)
        ?.temperature_report as Record<string, unknown> | undefined;
      const temperature = report?.temperature as number | undefined;
      return typeof temperature === "number" ? temperature : null;
    } catch (err) {
      logger.error({ err }, "Fehler beim Abrufen der Temperatur");
      return null;
    }
  }

  async getLightLevel(bridgeId: string, resourceId: string) {
    try {
      const resource = await this.fetchSingleResource(bridgeId, "light_level", resourceId);
      const report = (resource?.light as Record<string, unknown> | undefined)
        ?.light_level_report as Record<string, unknown> | undefined;
      const level = report?.light_level as number | undefined;
      return typeof level === "number" ? level : null;
    } catch (err) {
      logger.error({ err }, "Fehler beim Abrufen des Helligkeitswerts");
      return null;
    }
  }

  async getMotion(bridgeId: string, resourceId: string): Promise<MotionStatus | null> {
    try {
      const resource = await this.fetchSingleResource(bridgeId, "motion", resourceId);
      const report = (resource?.motion as Record<string, unknown> | undefined)
        ?.motion_report as Record<string, unknown> | undefined;
      const motion = report?.motion as boolean | undefined;
      const lastChanged = report?.changed as string | undefined;
      if (motion == null && lastChanged == null) return null;
      return { motion, lastChanged };
    } catch (err) {
      logger.error({ err }, "Fehler beim Abrufen des Bewegungsstatus");
      return null;
    }
  }

  async getSensitivity(bridgeId: string, resourceId: string) {
    try {
      const resource = await this.fetchSingleResource(bridgeId, "motion", resourceId);
      const sensitivity = (resource?.sensitivity as Record<string, unknown> | undefined)
        ?.sensitivity as number | undefined;
      return typeof sensitivity === "number" ? sensitivity : null;
    } catch (err) {
      logger.error({ err }, "Fehler beim Abrufen der Empfindlichkeit");
      return null;
    }
  }

  async setSensitivity(deviceId: string, sensitivity: number) {
    const info = await this.getDeviceInfo(deviceId);
    if (!info) return false;
    // Für kombinierte Geräte verwende motionRid, sonst hueResourceId
    const motionRid = info.motionRid ?? info.hueResourceId;
    if (!motionRid) return false;
    const data = {
      enabled: true,
      sensitivity: { sensitivity },
      type: "motion"
    };
    await this.updateResource(info.bridgeId, "motion", motionRid, data);
    return true;
  }

  private async setLightOnOff(bridgeId: string, hueResourceId: string, on: boolean) {
    const data = { on: { on } };
    await this.updateResource(bridgeId, "light", hueResourceId, data);
  }

  private async setLightBrightness(bridgeId: string, hueResourceId: string, brightness: number) {
    const data = { dimming: { brightness } };
    await this.updateResource(bridgeId, "light", hueResourceId, data);
  }

  private async setLightColor(bridgeId: string, hueResourceId: string, x: number, y: number) {
    const roundedX = Math.round(x * 1000) / 1000;
    const roundedY = Math.round(y * 1000) / 1000;
    const data = { color: { xy: { x: roundedX, y: roundedY } } };
    await this.updateResource(bridgeId, "light", hueResourceId, data);
  }

  private async setLightTemperature(bridgeId: string, hueResourceId: string, temperature: number) {
    const data = { color_temperature: { mirek: temperature } };
    await this.updateResource(bridgeId, "light", hueResourceId, data);
  }

  async setOn(deviceId: string, on: boolean) {
    const info = await this.getDeviceInfo(deviceId);
    if (!info || !info.hueResourceId) return false;
    await this.setLightOnOff(info.bridgeId, info.hueResourceId, on);
    return true;
  }

  async setBrightness(deviceId: string, brightness: number) {
    const info = await this.getDeviceInfo(deviceId);
    if (!info || !info.hueResourceId) return false;
    await this.setLightBrightness(info.bridgeId, info.hueResourceId, brightness);
    return true;
  }

  async setTemperature(deviceId: string, temperature: number) {
    const info = await this.getDeviceInfo(deviceId);
    if (!info || !info.hueResourceId) return false;
    await this.setLightTemperature(info.bridgeId, info.hueResourceId, temperature);
    return true;
  }

  async setColor(deviceId: string, x: number, y: number) {
    const info = await this.getDeviceInfo(deviceId);
    if (!info || !info.hueResourceId) return false;
    await this.setLightColor(info.bridgeId, info.hueResourceId, x, y);
    return true;
  }

  private async getDeviceInfo(deviceId: string) {
    if (!this.deviceRepository) {
      logger.warn("DeviceRepository nicht initialisiert");
      return null;
    }
    const device = this.deviceRepository.findById(deviceId);
    if (!device) {
      logger.warn({ deviceId }, "Device nicht gefunden");
      return null;
    }
    if (!device.bridgeId) {
      logger.warn({ deviceId }, "Device ohne BridgeId");
      return null;
    }
    // Für kombinierte Geräte können motionRid, lightLevelRid, temperatureRid vorhanden sein
    // Für einzelne Geräte ist hueResourceId vorhanden
    if (!device.hueResourceId && !device.motionRid && !device.lightLevelRid && !device.temperatureRid) {
      logger.warn({ deviceId }, "Device ohne Resource IDs");
      return null;
    }
    return {
      bridgeId: device.bridgeId,
      hueResourceId: device.hueResourceId as string | undefined,
      motionRid: device.motionRid as string | undefined,
      lightLevelRid: device.lightLevelRid as string | undefined,
      temperatureRid: device.temperatureRid as string | undefined
    };
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

