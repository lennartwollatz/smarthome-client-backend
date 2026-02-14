import { logger } from "../../../../logger.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { WACLightingDeviceController } from "./waclightingDeviceController.js";
import { WACLightingEvent } from "./waclightingEvent.js";
import { WACLIGHTINGMODULE } from "./waclightingModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { DeviceFanLight } from "../../../../model/devices/DeviceFanLight.js";

export class WACLightingEventStreamManager extends ModuleEventStreamManager<WACLightingDeviceController, WACLightingEvent> {
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLLING_INTERVAL_MS = 30000; // 30 Sekunden

  constructor(
    managerId: string,
    moduleId: string,
    controller: WACLightingDeviceController,
    actionManager: ActionManager
  ) {
    super(managerId, moduleId, controller, actionManager);
  }

  protected async startEventStream(callback: (event: WACLightingEvent) => void): Promise<void> {
    // Stoppe vorhandenes Polling
    this.stopPolling();

    // Starte Polling für alle WAC Lighting-Geräte
    this.pollingInterval = setInterval(async () => {
      await this.pollAllDevices(callback);
    }, this.POLLING_INTERVAL_MS);

    // Initiales Polling
    await this.pollAllDevices(callback);
    
    logger.info("WAC Lighting EventStream gestartet (Polling alle 30s)");
  }

  protected async stopEventStream(): Promise<void> {
    this.stopPolling();
    logger.info("WAC Lighting EventStream gestoppt");
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async pollAllDevices(callback: (event: WACLightingEvent) => void): Promise<void> {
    const devices = this.actionManager.getDevices();
    
    for (const device of devices) {
      if (device.moduleId !== WACLIGHTINGMODULE.id) continue;
      if (device.type !== DeviceType.FAN_LIGHT) continue;
      if (!(device instanceof DeviceFanLight)) continue;

      await this.pollDevice(device, callback);
    }
  }

  private async pollDevice(device: DeviceFanLight, callback: (event: WACLightingEvent) => void): Promise<void> {
    try {
      const deviceId = device.id;
      if (!deviceId) return;

      // Hole die IP-Adresse aus dem Device
      const address = (device as any).address as string | undefined;
      const port = (device as any).port as number | undefined;
      if (!address || !port) {
        logger.debug({ deviceId }, "Keine Adresse oder Port für WAC Lighting-Gerät gefunden");
        return;
      }

      // Lese aktuellen Status
      const status = await this.controller.getStatus(address, port);
      if (!status) return;

      // Prüfe auf Änderungen und erzeuge Events
      let changed = false;

      // Fan Status
      if (status.fanOn !== undefined && status.fanOn !== device.on) {
        callback({
          deviceid: deviceId,
          data: { type: "FanPower", value: status.fanOn }
        });
        changed = true;
      }

      if (status.fanSpeed !== undefined && status.fanSpeed !== device.speed) {
        callback({
          deviceid: deviceId,
          data: { type: "FanSpeed", value: status.fanSpeed }
        });
        changed = true;
      }

      // Light Status
      if (status.lightOn !== undefined && status.lightOn !== device.lightOn) {
        callback({
          deviceid: deviceId,
          data: { type: "LightPower", value: status.lightOn }
        });
        changed = true;
      }

      if (status.lightBrightness !== undefined && status.lightBrightness !== device.lightBrightness) {
        callback({
          deviceid: deviceId,
          data: { type: "LightBrightness", value: status.lightBrightness }
        });
        changed = true;
      }

      if (changed) {
        logger.debug({ deviceId }, "WAC Lighting Status aktualisiert");
      }
    } catch (err) {
      logger.error({ err, deviceId: device.id }, "Fehler beim Polling des WAC Lighting-Geräts");
    }
  }

  protected async handleEvent(event: WACLightingEvent): Promise<void> {
    if (!event.deviceid || !event.data) {
      return;
    }

    logger.debug({ deviceId: event.deviceid, eventType: event.data.type }, "WAC Lighting Event empfangen");

    const device = this.actionManager.getDevice(event.deviceid);
    if (!device || !(device instanceof DeviceFanLight)) {
      return;
    }

    try {
      const eventData = event.data;
      let shouldSave = false;

      switch (eventData.type) {
        case "FanPower":
          if (typeof eventData.value === "boolean") {
            if (eventData.value) {
              device.setOn(false);
            } else {
              device.setOff(false);
            }
            shouldSave = true;
          }
          break;

        case "FanSpeed":
          if (typeof eventData.value === "number") {
            device.setSpeed(eventData.value, false);
            shouldSave = true;
          }
          break;

        case "LightPower":
          if (typeof eventData.value === "boolean") {
            device.lightOn = eventData.value;
            shouldSave = true;
          }
          break;

        case "LightBrightness":
          if (typeof eventData.value === "number") {
            device.lightBrightness = eventData.value;
            shouldSave = true;
          }
          break;

        default:
          logger.debug({ deviceId: event.deviceid, eventType: eventData.type }, "Unbekannter WAC Lighting Event-Typ");
      }

      if (shouldSave) {
        this.actionManager.saveDevice(device);
      }
    } catch (err) {
      logger.error({ err, deviceId: event.deviceid }, "Fehler beim Verarbeiten von WAC Lighting Event");
    }
  }
}

