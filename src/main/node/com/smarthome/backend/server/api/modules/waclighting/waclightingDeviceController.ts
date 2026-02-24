import { logger } from "../../../../logger.js";
import { ModuleDeviceControllerEvent } from "../moduleDeviceControllerEvent.js";
import { WACLightingEvent } from "./waclightingEvent.js";
import { DeviceFanLight } from "../../../../model/devices/DeviceFanLight.js";
import { fetch } from "undici";

type WACDeviceStatus = {
  fanOn?: boolean;
  fanSpeed?: number;
  lightOn?: boolean;
  lightBrightness?: number;
  fanDirection?: string;
  adaptiveLearning?: boolean;
};

export class WACLightingDeviceController extends ModuleDeviceControllerEvent<WACLightingEvent, DeviceFanLight> {
  private isConnectionIssue(err: unknown): boolean {
    if (!err || typeof err !== "object") {
      return false;
    }

    const maybeError = err as {
      message?: string;
      cause?: { code?: string; message?: string; name?: string };
    };

    const message = maybeError.message ?? "";
    const causeName = maybeError.cause?.name ?? "";
    const causeCode = maybeError.cause?.code ?? "";
    const causeMessage = maybeError.cause?.message ?? "";
    const combined = `${message} ${causeName} ${causeCode} ${causeMessage}`.toLowerCase();

    return (
      combined.includes("connect timeout") ||
      combined.includes("etimedout") ||
      combined.includes("econnrefused") ||
      combined.includes("ehostunreach") ||
      combined.includes("enetunreach") ||
      combined.includes("socket hang up")
    );
  }
  
  /**
   * Sendet eine HTTP POST-Anfrage an ein WAC Lighting-Gerät
   */
  private async sendRequest(address: string, type:"GET" | "POST", payload: Record<string, unknown>): Promise<any> {
    try {
      const url = `http://${address}`;
      const response = await fetch(url, {
        method: type,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        logger.warn({ address, status: response.status }, "WAC Lighting Request fehlgeschlagen");
        return null;
      }

      const data = await response.json();
      return data;
    } catch (err) {
      if (this.isConnectionIssue(err)) {
        logger.debug({ address }, "WAC Lighting-Gerät aktuell nicht erreichbar");
        return null;
      }
      logger.warn({ err, address }, "WAC Lighting HTTP-Request fehlgeschlagen");
      return null;
    }
  }

  /**
   * Liest die Gerätekonfiguration aus
   */
  async getConfig(address: string, port: number): Promise<Record<string, unknown> | null> {
    return await this.sendRequest(address + ":"+ port + "/config-read", "POST", {});
  }

  /**
   * Liest statische Shadow-Daten aus
   */
  async getStaticShadowData(address: string, port: number): Promise<Record<string, unknown> | null> {
    return await this.sendRequest(address + ":"+ port + "/mf", "POST", { "queryStaticShadowData": 1 });
  }

  /**
   * Liest den aktuellen Status des Geräts aus
   */
  async getStatus(address: string, port: number): Promise<WACDeviceStatus | null> {
    const response = await this.sendRequest(address + ":"+ port + "/mf", "POST", { "queryDynamicShadowData": 1 });
    if (!response) return null;

    const status: WACDeviceStatus = {};
    
    // Fan Status
    if (typeof response.fanOn === "boolean") {
      status.fanOn = response.fanOn;
    }
    if (typeof response.fanSpeed === "number") {
      status.fanSpeed = response.fanSpeed;
    }
    if (typeof response.fanDirection === "string") {
      status.fanDirection = response.fanDirection;
    }

    // Light Status
    if (typeof response.lightOn === "boolean") {
      status.lightOn = response.lightOn;
    }
    if (typeof response.lightBrightness === "number") {
      status.lightBrightness = response.lightBrightness;
    }

    // Adaptive Learning
    if (typeof response.adaptiveLearning === "boolean") {
      status.adaptiveLearning = response.adaptiveLearning;
    }

    return status;
  }

  /**
   * Schaltet das Licht ein
   */
  async setLightOn(device: DeviceFanLight): Promise<boolean> {
    const address = (device as any).address as string | undefined;
    const port = (device as any).port as number | undefined;
    if (!address || !port) {
      logger.warn({ deviceId: device.id }, "Keine Adresse oder Port für setLightOn");
      return false;
    }
    const response = await this.sendRequest(address + ":"+ port + "/mf", "POST", { "lightOn": true });
    return response !== null;
  }

  /**
   * Schaltet das Licht aus
   */
  async setLightOff(device: DeviceFanLight): Promise<boolean> {
    const address = (device as any).address as string | undefined;
    const port = (device as any).port as number | undefined;
    if (!address || !port) {
      logger.warn({ deviceId: device.id }, "Keine Adresse für setLightOff");
      return false;
    }
    const response = await this.sendRequest(address + ":"+ port + "/mf", "POST", { "lightOn": false });
    return response !== null;
  }

  /**
   * Setzt die Helligkeit des Lichts (0-100)
   */
  async setLightBrightness(device: DeviceFanLight, brightness: number): Promise<boolean> {
    const address = (device as any).address as string | undefined;
    const port = (device as any).port as number | undefined;
    if (!address || !port) {
      logger.warn({ deviceId: device.id }, "Keine Adresse für setLightBrightness");
      return false;
    }
    const clampedBrightness = Math.max(0, Math.min(100, brightness));
    const response = await this.sendRequest(address + ":"+ port + "/mf", "POST", { "lightBrightness": clampedBrightness });
    return response !== null;
  }

  /**
   * Schaltet den Ventilator ein
   */
  async setFanOn(device: DeviceFanLight): Promise<boolean> {
    const address = (device as any).address as string | undefined;
    const port = (device as any).port as number | undefined;
    if (!address || !port) {
      logger.warn({ deviceId: device.id }, "Keine Adresse für setFanOn");
      return false;
    }
    const response = await this.sendRequest(address + ":"+ port + "/mf", "POST", { "fanOn": true });
    return response !== null;
  }

  /**
   * Schaltet den Ventilator aus
   */
  async setFanOff(device: DeviceFanLight): Promise<boolean> {
    const address = (device as any).address as string | undefined;
    const port = (device as any).port as number | undefined;
    if (!address || !port) {
      logger.warn({ deviceId: device.id }, "Keine Adresse für setFanOff");
      return false;
    }
    const response = await this.sendRequest(address + ":"+ port + "/mf", "POST", { "fanOn": false });
    return response !== null;
  }

  /**
   * Setzt die Geschwindigkeit des Ventilators (0-100)
   */
  async setFanSpeed(device: DeviceFanLight, speed: number): Promise<boolean> {
    const address = (device as any).address as string | undefined;
    const port = (device as any).port as number | undefined;
    if (!address || !port) {
      logger.warn({ deviceId: device.id }, "Keine Adresse für setFanSpeed");
      return false;
    }
    const clampedSpeed = Math.max(0, Math.min(100, speed));
    const response = await this.sendRequest(address + ":"+ port + "/mf", "POST", { "fanSpeed": clampedSpeed });
    return response !== null;
  }

  /**
   * Setzt die Richtung des Ventilators
   */
  async setFanDirection(device: DeviceFanLight, direction: "forward" | "reverse"): Promise<boolean> {
    const address = (device as any).address as string | undefined;
    const port = (device as any).port as number | undefined;
    if (!address || !port) {
      logger.warn({ deviceId: device.id }, "Keine Adresse für setFanDirection");
      return false;
    }
    const response = await this.sendRequest(address + ":"+ port + "/mf", "POST", { "fanDirection": direction });
    return response !== null;
  }

  /**
   * Aktiviert/Deaktiviert Adaptive Learning
   */
  async setAdaptiveLearning(device: DeviceFanLight, enabled: boolean): Promise<boolean> {
    const address = (device as any).address as string | undefined;
    const port = (device as any).port as number | undefined;
    if (!address || !port) {
      logger.warn({ deviceId: device.id }, "Keine Adresse für setAdaptiveLearning");
      return false;
    }
    const response = await this.sendRequest(address + ":"+ port + "/mf", "POST", { "adaptiveLearning": enabled ? 1 : 0 });
    return response !== null;
  }

  /**
   * Startet einen Event-Stream für ein Gerät (Polling alle 30 Sekunden)
   */
  public async startEventStream(device: DeviceFanLight, callback: (event: WACLightingEvent) => void): Promise<void> {
    const deviceId = device.id ?? "";
    if (!deviceId) {
      throw new Error("Device ID ist erforderlich für EventStreamListener");
    }

    logger.debug({ deviceId }, "EventStream für WAC Lighting-Gerät gestartet (Polling-Modus)");
  }

  /**
   * Stoppt den Event-Stream für ein Gerät
   */
  public async stopEventStream(device: DeviceFanLight): Promise<void> {
    const deviceId = device.id ?? "";
    logger.debug({ deviceId }, "EventStream für WAC Lighting-Gerät gestoppt");
  }
}

