import https from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import { logger } from "../../../../logger.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import { HueDiscoveredBridge } from "./hueDiscoveredBridge.js";
import type { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { Device } from "../../../../model/devices/Device.js";
import { DeviceLight } from "../../../../model/devices/DeviceLight.js";
import { DeviceLightDimmer } from "../../../../model/devices/DeviceLightDimmer.js";
import { DeviceLightDimmerTemperature } from "../../../../model/devices/DeviceLightDimmerTemperature.js";
import { DeviceLightDimmerTemperatureColor } from "../../../../model/devices/DeviceLightDimmerTemperatureColor.js";
import { DeviceLightLevel } from "../../../../model/devices/DeviceLightLevel.js";
import { DeviceMotion } from "../../../../model/devices/DeviceMotion.js";
import { DeviceSwitch } from "../../../../model/devices/DeviceSwitch.js";
import { DeviceTemperature } from "../../../../model/devices/DeviceTemperature.js";

export class HueModuleEventStreamManager implements ModuleEventStreamManager {
  private bridgeId: string;
  private actionManager: ActionManager;
  private bridgeRepository: JsonRepository<HueDiscoveredBridge>;
  private running = false;
  private request?: ClientRequest;
  private response?: IncomingMessage;

  constructor(bridgeId: string, actionManager: ActionManager, databaseManager: DatabaseManager) {
    this.bridgeId = bridgeId;
    this.actionManager = actionManager;
    this.bridgeRepository = new JsonRepository<HueDiscoveredBridge>(databaseManager, "HueDiscoveredBridge");
  }

  async start() {
    logger.info({ bridgeId: this.bridgeId }, "Starte EventStream fuer Bridge");
    if (this.running) {
      logger.warn({ bridgeId: this.bridgeId }, "EventStream fuer Bridge laeuft bereits");
      return;
    }
    const bridge = this.bridgeRepository.findById(this.bridgeId);
    if (!bridge) {
      throw new Error(`Bridge mit ID '${this.bridgeId}' nicht gefunden`);
    }
    if (!bridge.isPaired || !bridge.username) {
      throw new Error(`Bridge '${this.bridgeId}' ist nicht gepaart`);
    }
    const bridgeIp = bridge.ipAddress;
    const port = this.resolveEventStreamPort(bridge.port);
    const username = bridge.username;
    if (!bridgeIp) {
      throw new Error(`Keine gueltige IP-Adresse fuer Bridge '${this.bridgeId}'`);
    }

    this.running = true;
    this.startEventStream(bridgeIp, port, username);
  }

  stop() {
    if (!this.running) {
      logger.debug("EventStream fuer Bridge {} laeuft nicht", this.bridgeId);
      return;
    }
    logger.info({ bridgeId: this.bridgeId }, "Stoppe EventStream fuer Bridge");
    this.running = false;
    this.response?.destroy();
    this.request?.destroy();
  }

  isRunning() {
    return this.running;
  }

  getModuleId() {
    return "hue";
  }

  getManagerId() {
    return this.bridgeId;
  }

  getDescription() {
    return `Hue EventStream fuer Bridge ${this.bridgeId}`;
  }

  private startEventStream(bridgeIp: string, port: number, username: string) {
    const eventStreamUrl = `https://${bridgeIp}:${port}/eventstream/clip/v2`;
    const agent = new https.Agent({ rejectUnauthorized: false });
    const request = https.request(
      eventStreamUrl,
      {
        method: "GET",
        headers: {
          "hue-application-key": username,
          Accept: "text/event-stream"
        },
        agent
      },
      response => {
        if (response.statusCode !== 200) {
          logger.error(
            { bridgeId: this.bridgeId, statusCode: response.statusCode },
            "Eventstream-Verbindung fehlgeschlagen"
          );
          this.running = false;
          response.resume();
          return;
        }

        this.response = response;
        response.setEncoding("utf8");
        let eventData = "";
        let buffer = "";

        response.on("data", (chunk: string) => {
          buffer += chunk;
          let index = buffer.indexOf("\n");
          while (index !== -1) {
            const line = buffer.slice(0, index).replace(/\r$/, "");
            buffer = buffer.slice(index + 1);
            if (line.startsWith("data:")) {
              const data = line.slice(5).trim();
              eventData += data;
              if (data.endsWith("]")) {
                this.processEventData(eventData);
                eventData = "";
              }
            } else if (line.length === 0) {
              if (eventData.length > 0) {
                this.processEventData(eventData);
                eventData = "";
              }
            }
            index = buffer.indexOf("\n");
          }
        });

        response.on("end", () => {
          this.running = false;
        });
      }
    );

    request.on("error", err => {
      if (this.running) {
        logger.error({ err, bridgeId: this.bridgeId }, "Fehler im Eventstream fuer Bridge");
      }
      this.running = false;
    });

    request.end();
    this.request = request;
  }

  private resolveEventStreamPort(port?: number) {
    if (!port || port === 80) return 443;
    return port;
  }

  private processEventData(eventDataJson: string) {
    logger.info({ bridgeId: this.bridgeId }, "Verarbeite Eventstream-Daten");
    try {
      const events = JSON.parse(eventDataJson) as Array<Record<string, unknown>>;
      for (const event of events ?? []) {
        const dataArray = (event as any).data as Array<Record<string, unknown>> | undefined;
        if (!Array.isArray(dataArray)) continue;
        for (const data of dataArray) {
          this.handleEventStreamEvent(data);
        }
      }
    } catch (err) {
      logger.warn({ err, bridgeId: this.bridgeId }, "Fehler beim Parsen von Event-Daten");
    }
  }

  private handleEventStreamEvent(eventData: Record<string, unknown>) {
    console.log("eventData: "+JSON.stringify(eventData));
    try {
      const resourceType = typeof eventData.type === "string" ? eventData.type : null;
      let resourceId: string | null = null;

      if (resourceType === "button") {
        const owner = eventData.owner as { rid?: string } | undefined;
        resourceId = owner?.rid ?? (typeof eventData.id === "string" ? eventData.id : null);
      } else {
        resourceId = typeof eventData.id === "string" ? eventData.id : null;
      }

      if (!resourceType || !resourceId) {
        return;
      }

      if (resourceType === "light") {
        this.updateLightFromEvent(resourceId, eventData);
      } else if (resourceType === "button") {
        this.updateButtonFromEvent(resourceId, eventData);
      } else if (resourceType === "motion") {
        this.updateMotionSensorFromEvent(resourceId, eventData);
      } else if (resourceType === "temperature") {
        this.updateTemperatureSensorFromEvent(resourceId, eventData);
      } else if (resourceType === "light_level") {
        this.updateLightLevelSensorFromEvent(resourceId, eventData);
      }
    } catch (err) {
      logger.error({ err }, "Fehler beim Verarbeiten von Eventstream-Event");
    }
  }

  private updateLightFromEvent(resourceId: string, eventData: Record<string, unknown>) {
    const deviceId = `hue-light-${resourceId}`;
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return;
    if (!(device instanceof DeviceLight)) return;

    const onObj = (eventData as any).on as { on?: boolean } | undefined;
    if (onObj && typeof onObj.on === "boolean") {
      const isOn = onObj.on;
      const currentOn = typeof (device as any).onState === "function" ? (device as any).onState() : device.on;
      if (isOn !== currentOn) {
        if (isOn) {
          device.setOn(false);
        } else {
          device.setOff(false);
        }
      }
    }

    if (device instanceof DeviceLightDimmer) {
      const dimming = (eventData as any).dimming as { brightness?: number } | undefined;
      if (dimming && typeof dimming.brightness === "number") {
        const brightness = Math.round(dimming.brightness);
        if (!device.brightnessEquals(brightness)) {
          device.setBrightness(brightness, false);
        }
      }
    }

    if (device instanceof DeviceLightDimmerTemperatureColor) {
      const colorObj = (eventData as any).color as { xy?: { x?: number; y?: number } } | undefined;
      const xy = colorObj?.xy;
      if (xy && typeof xy.x === "number" && typeof xy.y === "number") {
        const x = Math.round(xy.x * 1000) / 1000;
        const y = Math.round(xy.y * 1000) / 1000;
        device.setColor(x, y, false);
      }
    }

    if (device instanceof DeviceLightDimmerTemperature) {
      const temp = (eventData as any).color_temperature as { mirek?: number } | undefined;
      if (temp && typeof temp.mirek === "number") {
        const mirek = temp.mirek;
        if (!device.temperatureEquals(mirek)) {
          device.setTemperature(mirek, false);
        }
      }
    }

    this.actionManager.saveDevice(device);
  }

  private updateButtonFromEvent(resourceId: string, eventData: Record<string, unknown>) {
    const deviceId = `hue-button-${resourceId}`;
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return;
    if (!(device instanceof DeviceSwitch)) return;

    const buttonId = typeof eventData.id === "string" ? eventData.id : resourceId;
    const report = (eventData as any).button_report as { event?: string } | undefined;
    const event = report?.event;
    if (event === "short_release" || event === "long_release") {
      device.toggle(buttonId, false);
    }
    this.actionManager.saveDevice(device);
  }

  private updateMotionSensorFromEvent(resourceId: string, eventData: Record<string, unknown>) {
    const deviceId = `hue-motion-${resourceId}`;
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return;
    if (!(device instanceof DeviceMotion)) return;

    const motionObj = (eventData as any).motion as { motion_report?: any } | undefined;
    const report = motionObj?.motion_report;
    if (report && typeof report.changed === "string" && typeof report.motion === "boolean") {
      device.setMotion(report.motion, report.changed, false);
    }
    this.actionManager.saveDevice(device);
  }

  private updateTemperatureSensorFromEvent(resourceId: string, eventData: Record<string, unknown>) {
    const deviceId = `hue-temperature-${resourceId}`;
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return;
    if (!(device instanceof DeviceTemperature)) return;

    const tempObj = (eventData as any).temperature as { temperature?: number } | undefined;
    if (tempObj && typeof tempObj.temperature === "number") {
      const temperature = Math.round(tempObj.temperature);
      if (!device.temperatureEquals(temperature)) {
        device.setTemperature(temperature, false);
      }
    }
    this.actionManager.saveDevice(device);
  }

  private updateLightLevelSensorFromEvent(resourceId: string, eventData: Record<string, unknown>) {
    const deviceId = `hue-light_level-${resourceId}`;
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return;
    if (!(device instanceof DeviceLightLevel)) return;

    const lightObj = (eventData as any).light as { light_level?: number } | undefined;
    if (lightObj && typeof lightObj.light_level === "number") {
      const lightLevel = lightObj.light_level;
      if (!device.levelEquals(lightLevel)) {
        device.setLightLevel(lightLevel, false);
      }
    }
    this.actionManager.saveDevice(device);
  }
}

