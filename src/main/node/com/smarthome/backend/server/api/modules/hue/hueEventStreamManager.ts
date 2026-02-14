import { logger } from "../../../../logger.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import { HueBridgeDiscovered } from "./hueBridgeDiscovered.js";
import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { DeviceLight } from "../../../../model/devices/DeviceLight.js";
import { DeviceLightDimmer } from "../../../../model/devices/DeviceLightDimmer.js";
import { DeviceLightDimmerTemperature } from "../../../../model/devices/DeviceLightDimmerTemperature.js";
import { DeviceLightDimmerTemperatureColor } from "../../../../model/devices/DeviceLightDimmerTemperatureColor.js";
import { DeviceLightLevel } from "../../../../model/devices/DeviceLightLevel.js";
import { DeviceMotion } from "../../../../model/devices/DeviceMotion.js";
import { DeviceSwitch } from "../../../../model/devices/DeviceSwitch.js";
import { DeviceTemperature } from "../../../../model/devices/DeviceTemperature.js";
import { HueBridgeController } from "./hueBridgeController.js";
import { HueEvent } from "./hueEvent.js";
import { HUECONFIG } from "./hueModule.js";

export class HueEventStreamManager extends ModuleEventStreamManager<HueBridgeController, HueEvent> {
  private repository: JsonRepository<HueBridgeDiscovered>;

  constructor(managerId:string, controller: HueBridgeController, actionManager: ActionManager, databaseManager: DatabaseManager) {
    super(managerId, HUECONFIG.id, controller, actionManager);
    this.repository = new JsonRepository<HueBridgeDiscovered>(databaseManager, "HueDiscoveredBridge");
  }

  protected async startEventStream(callback: (event: HueEvent) => void): Promise<void> {
    const bridges = this.repository.findAll();
    for (const bridge of bridges) {
      if( bridge.isPaired && bridge.username && bridge.address ) {
        this.controller.startEventStream(bridge, callback);
      }
    }
  }

  protected async stopEventStream(): Promise<void> {
    const bridges = this.repository.findAll();
    for (const bridge of bridges) {
      this.controller.stopEventStream(bridge);
    }
  }

  protected async handleEvent(event: HueEvent): Promise<void> {
    logger.debug("handleEvent: " + JSON.stringify(event.data));
    const eventData = event.data;

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

      // Verarbeite Event für Device-Updates
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

