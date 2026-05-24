import { logger } from "../../../../logger.js";
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
import type { Device } from "../../../../model/devices/Device.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { mirekToLightTemperaturePercent, rawSensitivityToPercent } from "./hueDeviceController.js";
import { DeviceLightLevelMotionTemperature } from "com/smarthome/backend/model/devices/DeviceLightLevelMotionTemperature.js";
import { DeviceSwitchDimmer } from "com/smarthome/backend/model/devices/DeviceSwitchDimmer.js";

type HueDeviceWithResources = Device & {
  bridgeId?: string;
  hueResourceId?: string;
  motionRid?: string;
  lightLevelRid?: string;
  temperatureRid?: string;
};

export class HueEventStreamManager extends ModuleEventStreamManager<HueBridgeController, HueEvent> {
  private repository: JsonRepository<HueBridgeDiscovered>;

  constructor(managerId:string, controller: HueBridgeController, deviceManager: DeviceManager, databaseManager: DatabaseManager) {
    super(managerId, HUECONFIG.id, controller, deviceManager);
    this.repository = new JsonRepository<HueBridgeDiscovered>(databaseManager, HUECONFIG.bridgeTypeName);
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
    logger.debug({ bridgeId: event.bridgeId, data: event.data }, "Hue Eventstream");
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

      if (!resourceType || !resourceId || !event.bridgeId) {
        return;
      }

      const bridgeId = event.bridgeId;

      // Verarbeite Event für Device-Updates
      if (resourceType === "light") {
        this.updateLightFromEvent(bridgeId, resourceId, eventData);
      } else if (resourceType === "button") {
        this.updateButtonFromEvent(bridgeId, resourceId, eventData);
      } else if (resourceType === "motion") {
        this.updateMotionSensorFromEvent(bridgeId, resourceId, eventData);
      } else if (resourceType === "temperature") {
        this.updateTemperatureSensorFromEvent(bridgeId, resourceId, eventData);
      } else if (resourceType === "light_level") {
        this.updateLightLevelSensorFromEvent(bridgeId, resourceId, eventData);
      }
    } catch (err) {
      logger.error({ err }, "Fehler beim Verarbeiten von Eventstream-Event");
    }
  }

  private hueDeviceId(bridgeId: string, resourceId: string): string {
    return `hue-${bridgeId}-${resourceId}`;
  }

  /**
   * Sucht Hue-Gerät per `hue-<bridgeId>-<resourceId>` oder per gespeicherter Service-RID
   * (Discovery nutzt oft die Device-ID, Events liefern die Resource-ID).
   */
  private findHueDevice(bridgeId: string, resourceId: string): Device | undefined {
    const direct = this.deviceManager.getDevice(this.hueDeviceId(bridgeId, resourceId));
    if (direct) return direct;

    for (const device of this.deviceManager.getDevicesForModule(HUECONFIG.id)) {
      const d = device as HueDeviceWithResources;
      if (d.bridgeId !== bridgeId) continue;
      if (
        d.hueResourceId === resourceId ||
        d.motionRid === resourceId ||
        d.lightLevelRid === resourceId ||
        d.temperatureRid === resourceId
      ) {
        return device;
      }
    }
    return undefined;
  }

  private updateLightFromEvent(bridgeId: string, resourceId: string, eventData: Record<string, unknown>) {
    const device = this.findHueDevice(bridgeId, resourceId);
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
        if (device.brightness !== brightness) {
          device.setBrightness(brightness, false);
        }
      }
    }

    if (device instanceof DeviceLightDimmerTemperatureColor) {
      const colorObj = (eventData as any).color as { xy?: { x?: number; y?: number } } | undefined;
      const xy = colorObj?.xy;
      if (xy && typeof xy.x === "number" && typeof xy.y === "number") {
        const x = Math.round(Math.max(0, Math.min(1, xy.x)) * 1000) / 1000;
        const y = Math.round(Math.max(0, Math.min(1, xy.y)) * 1000) / 1000;
        device.setColor(x, y, false);
      }
    }

    if (device instanceof DeviceLightDimmerTemperature) {
      const temp = (eventData as any).color_temperature as { mirek?: number } | undefined;
      if (temp && typeof temp.mirek === "number") {
        const mirek = temp.mirek;
        const percent = mirekToLightTemperaturePercent(mirek);
        if (device.temperature !== percent) {
          device.setTemperature(percent, false);
        }
      }
    }

    this.deviceManager.saveDevice(device);
  }

  private updateButtonFromEvent(bridgeId: string, resourceId: string, eventData: Record<string, unknown>) {
    const device = this.findHueDevice(bridgeId, resourceId);
    if (!device) return;

    const buttonId = typeof eventData.id === "string" ? eventData.id : resourceId;
    const report = (eventData as any).button_report as { event?: string } | undefined;
    const event = report?.event;
    if (event === "short_release" || event === "long_release") {
      (device as DeviceSwitch | DeviceSwitchDimmer).toggle(buttonId, false);
    }
    this.deviceManager.saveDevice(device);
  }

  private updateMotionSensorFromEvent(bridgeId: string, resourceId: string, eventData: Record<string, unknown>) {
    const device = this.findHueDevice(bridgeId, resourceId);
    if (!device) return;

    const motionDevice = device as DeviceMotion | DeviceLightLevelMotionTemperature;

    const motionObj = (eventData as any).motion as { motion_report?: any } | undefined;
    const report = motionObj?.motion_report;
    if (report && typeof report.changed === "string" && typeof report.motion === "boolean") {
      motionDevice.setMotion(report.motion, report.changed, false);
    }

    const sensObj = (eventData as any).sensitivity as
      | { sensitivity?: number; sensitivity_max?: number }
      | undefined;
    if (sensObj) {
      if (typeof sensObj.sensitivity_max === "number" && sensObj.sensitivity_max > 0) {
        motionDevice.max_sensitivity = sensObj.sensitivity_max;
      }
      if (typeof sensObj.sensitivity === "number") {
        const max = motionDevice.max_sensitivity ?? sensObj.sensitivity_max ?? 0;
        const percent = rawSensitivityToPercent(sensObj.sensitivity, max);
        if (motionDevice.sensitivity !== percent) {
          void motionDevice.setSensibility(percent, false);
        }
      }
    }

    this.deviceManager.saveDevice(device);
  }

  private updateTemperatureSensorFromEvent(bridgeId: string, resourceId: string, eventData: Record<string, unknown>) {
    const device = this.findHueDevice(bridgeId, resourceId);
    if (!device) return;

    const tempObj = (eventData as any).temperature as { temperature?: number } | undefined;
    if (tempObj && typeof tempObj.temperature === "number") {
      const temperature = Math.round(tempObj.temperature);
      if ((device as DeviceTemperature | DeviceLightLevelMotionTemperature).temperature !== temperature) {
        (device as DeviceTemperature | DeviceLightLevelMotionTemperature).setTemperature(temperature, false);
      }
    }
    this.deviceManager.saveDevice(device);
  }

  private updateLightLevelSensorFromEvent(bridgeId: string, resourceId: string, eventData: Record<string, unknown>) {
    const device = this.findHueDevice(bridgeId, resourceId);
    if (!device) return;

    const lightObj = (eventData as any).light as { light_level?: number } | undefined;
    if (lightObj && typeof lightObj.light_level === "number") {
      const lightLevel = lightObj.light_level;
      if ((device as DeviceLightLevel | DeviceLightLevelMotionTemperature).lightLevel !== lightLevel) {
        (device as DeviceLightLevel | DeviceLightLevelMotionTemperature).setLightLevel(lightLevel, false);
      }
    }
    this.deviceManager.saveDevice(device);
  }
}

