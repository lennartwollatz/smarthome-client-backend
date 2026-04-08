import { logger } from "../../../../logger.js";
import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { SonoffDeviceController } from "./sonoffDeviceController.js";
import { SonoffEvent } from "./sonoffEvent.js";
import { SONOFFMODULE } from "./sonoffModule.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { Device } from "../../../../model/devices/Device.js";
import { SonoffSwitchDimmer } from "./devices/sonoffSwitchDimmer.js";
import { SonoffSwitch } from "./devices/sonoffSwitch.js";
import { SonoffSwitchEnergy } from "./devices/sonoffSwitchEnergy.js";

export class SonoffEventStreamManager extends ModuleEventStreamManager<SonoffDeviceController, SonoffEvent> {
  constructor(managerId: string, controller: SonoffDeviceController, deviceManager: DeviceManager) {
    super(managerId, SONOFFMODULE.id, controller, deviceManager);
  }

  protected async startEventStream(callback: (event: SonoffEvent) => void): Promise<void> {
    const devices = this.deviceManager.getDevicesForModule(SONOFFMODULE.id);
    try {
      await this.controller.startLanLiveEventStream(devices, callback);
    } catch (err) {
      logger.error({ err }, "Fehler beim Starten des Sonoff-EventStreams");
    }
  }

  protected async stopEventStream(): Promise<void> {
    try {
      await this.controller.stopLanLiveEventStream();
    } catch (err) {
      logger.error({ err }, "Fehler beim Stoppen des Sonoff-EventStreams");
    }
  }

  protected handleEvent(event: SonoffEvent): void {
    const id = event.deviceId;
    if (id && event.payload) {
      const device = this.deviceManager.getDevice(id);
      if (device) {
        try {
          this.applySonoffStreamPayloadToDevice(device, event.payload as Record<string, unknown>);
        } catch (err) {
          logger.debug({ err, deviceId: id }, "Sonoff Stream-Payload anwenden fehlgeschlagen");
        }
        this.deviceManager.saveDevice(device);
      }
    }
  }

/**
 * Werte aus dem Python-getState-Payload ins Gerätemodell übernehmen (ohne Speichern).
 */
private applySonoffStreamPayloadToDevice(device: Device, payload: Record<string, unknown>): void {
  const switches = payload.switches;
  const data = payload.data;
  if( payload.ok !== true) {
    return;
  }
  if (switches && Array.isArray(switches)) {
    (device as SonoffSwitch | SonoffSwitchEnergy).updateValuesFromPayload(payload, true);
  } else if (data) {
    (device as SonoffSwitchEnergy).updateStatisticsFromPayload(payload, true);
  } else {
    (device as SonoffSwitchDimmer).updateValuesFromPayload(payload, true);
  }
}

}
