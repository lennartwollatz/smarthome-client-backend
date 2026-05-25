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

type StaleSensorMetric = "temperature" | "lightLevel";

/**
 * Schwelle (ms), nach der ein Sensor (Temperatur/Lichtintensität) ohne
 * eingehende Hue-Events als "stale" gilt und aktiv per HTTP nachgefragt wird.
 */
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Wie oft der Watchdog die letzten Eventzeiten prüft.
 */
const STALE_CHECK_INTERVAL_MS = 60 * 1000;

export class HueEventStreamManager extends ModuleEventStreamManager<HueBridgeController, HueEvent> {
  private repository: JsonRepository<HueBridgeDiscovered>;
  /**
   * Letzter Zeitpunkt (ms), zu dem ein Event für ein Device + Metrik
   * verarbeitet wurde. Wird im Watchdog gegen `STALE_THRESHOLD_MS` geprüft.
   * Key: `deviceId`, innerer Key: Metrik ("temperature" | "lightLevel").
   */
  private lastEventTime: Map<string, Map<StaleSensorMetric, number>> = new Map();
  private staleWatchdogTimer?: NodeJS.Timeout;
  /** Verhindert, dass für dasselbe Sensor-Device mehrere Pollings parallel laufen. */
  private inflightPolls: Set<string> = new Set();

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
    this.initialiseLastEventTimes();
    this.startStaleWatchdog();
  }

  protected async stopEventStream(): Promise<void> {
    this.stopStaleWatchdog();
    const bridges = this.repository.findAll();
    for (const bridge of bridges) {
      this.controller.stopEventStream(bridge);
    }
  }

  /**
   * Setzt für alle bekannten Hue-Sensoren mit Temperatur/Lichtintensität die
   * `lastEventTime` initial auf "jetzt". Dadurch beginnt die 5-Min-Frist
   * erst ab Start des EventStream-Managers; ein sofortiges Polling wird
   * vermieden, falls die Bridge gerade keine Events schickt.
   */
  private initialiseLastEventTimes(): void {
    const now = Date.now();
    for (const device of this.deviceManager.getDevicesForModule(HUECONFIG.id)) {
      const d = device as HueDeviceWithResources;
      if (!d.id) continue;
      const metrics = new Map<StaleSensorMetric, number>();
      if (d.temperatureRid || (d.hueResourceId && this.isTemperatureSensor(d))) {
        metrics.set("temperature", now);
      }
      if (d.lightLevelRid || (d.hueResourceId && this.isLightLevelSensor(d))) {
        metrics.set("lightLevel", now);
      }
      if (metrics.size > 0) {
        this.lastEventTime.set(d.id, metrics);
      }
    }
  }

  private isTemperatureSensor(device: HueDeviceWithResources): boolean {
    return (device as { temperature?: number }).temperature !== undefined;
  }

  private isLightLevelSensor(device: HueDeviceWithResources): boolean {
    return (device as { lightLevel?: number }).lightLevel !== undefined;
  }

  private startStaleWatchdog(): void {
    if (this.staleWatchdogTimer) return;
    this.staleWatchdogTimer = setInterval(() => {
      void this.checkStaleSensors();
    }, STALE_CHECK_INTERVAL_MS);
  }

  private stopStaleWatchdog(): void {
    if (this.staleWatchdogTimer) {
      clearInterval(this.staleWatchdogTimer);
      this.staleWatchdogTimer = undefined;
    }
    this.inflightPolls.clear();
  }

  private markEventReceived(deviceId: string, metric: StaleSensorMetric): void {
    let metrics = this.lastEventTime.get(deviceId);
    if (!metrics) {
      metrics = new Map<StaleSensorMetric, number>();
      this.lastEventTime.set(deviceId, metrics);
    }
    metrics.set(metric, Date.now());
  }

  /**
   * Iteriert über alle bekannten Sensor-Devices und löst für jene ein
   * Polling über {@link Device.updateValues} aus, deren letztes Event für
   * Temperatur bzw. Lichtintensität älter als {@link STALE_THRESHOLD_MS} ist.
   */
  private async checkStaleSensors(): Promise<void> {
    const now = Date.now();
    for (const [deviceId, metrics] of this.lastEventTime.entries()) {
      let stale = false;
      for (const [, lastTime] of metrics.entries()) {
        if (now - lastTime > STALE_THRESHOLD_MS) {
          stale = true;
          break;
        }
      }
      if (!stale) continue;
      if (this.inflightPolls.has(deviceId)) continue;
      this.inflightPolls.add(deviceId);
      void this.pollSensor(deviceId, metrics).finally(() => {
        this.inflightPolls.delete(deviceId);
      });
    }
  }

  private async pollSensor(deviceId: string, metrics: Map<StaleSensorMetric, number>): Promise<void> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) {
      this.lastEventTime.delete(deviceId);
      return;
    }
    const updatable = device as Device & { updateValues?: () => Promise<void> };
    if (typeof updatable.updateValues !== "function") return;

    try {
      logger.info(
        { deviceId, metrics: Array.from(metrics.keys()) },
        "Hue Sensor stale (>5 min ohne Event), erzwinge Refresh"
      );
      await updatable.updateValues();
      // saveDevice triggert recordSensorHistoryIfChanged und sensorHistory:updated Live-Events.
      this.deviceManager.saveDevice(device);
    } catch (err) {
      logger.warn({ err, deviceId }, "Hue Sensor-Refresh fehlgeschlagen");
    } finally {
      // Timer zurücksetzen, damit nicht im nächsten Intervall sofort erneut gepollt wird.
      const now = Date.now();
      for (const key of metrics.keys()) {
        metrics.set(key, now);
      }
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

    if (device.id) {
      this.markEventReceived(device.id, "temperature");
    }

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

    if (device.id) {
      this.markEventReceived(device.id, "lightLevel");
    }

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

