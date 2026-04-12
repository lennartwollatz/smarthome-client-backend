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
   * Werte aus dem Python-Live-Stream (getState --live) ins Modell übernehmen.
   * Zeilen: kombinierter Snapshot ``{ ok, basicInfo, … }``, periodisch ``statistics``,
   * oder rohe mDNS-Teilobjekte ohne ``ok``.
   */
  private applySonoffStreamPayloadToDevice(device: Device, payload: Record<string, unknown>): void {
    const endpoint = typeof payload.endpoint === "string" ? payload.endpoint : "";

    if (payload.ok === true && endpoint === "statistics" && payload.data !== undefined) {
      if (device instanceof SonoffSwitchEnergy) {
        void (device as SonoffSwitchEnergy).updateStatisticsFromPayload(payload, true);
      }
      return;
    }

    if (payload.ok === true && (payload.basicInfo !== undefined || payload.switch !== undefined)) {
      const basicInfo = payload.basicInfo as Record<string, unknown> | undefined;
      const basicSwitches = basicInfo?.switches;
      const topSwitches = payload.switches;
      const hasSwitchList =
        (Array.isArray(topSwitches) && topSwitches.length > 0) ||
        (Array.isArray(basicSwitches) && basicSwitches.length > 0);

      if (hasSwitchList && (device instanceof SonoffSwitch || device instanceof SonoffSwitchEnergy)) {
        void (device as SonoffSwitch | SonoffSwitchEnergy).updateValuesFromPayload(payload, true);
        return;
      }

      if (payload.data && device instanceof SonoffSwitchEnergy) {
        void (device as SonoffSwitchEnergy).updateStatisticsFromPayload(payload, true);
        return;
      }

      if (device instanceof SonoffSwitchDimmer) {
        (device as SonoffSwitchDimmer).updateValuesFromPayload(payload, true);
      }
      return;
    }

    if (payload.ok === undefined) {
      const p = payload as Record<string, unknown>;
      if (device instanceof SonoffSwitchEnergy) {
        const keys = Object.keys(p);
        const energyLike = keys.some(
          k =>
            k.startsWith("actPow_") ||
            k.startsWith("current_") ||
            k.startsWith("voltage_") ||
            k.startsWith("reactPow_") ||
            k.startsWith("apparentPow_")
        );
        if (energyLike) {
          void (device as SonoffSwitchEnergy).updateStatisticsFromPayload({ ok: true, data: p }, true);
        }
        const swE = p.switches;
        if (Array.isArray(swE) && swE.length > 0) {
          void (device as SonoffSwitchEnergy).updateValuesFromPayload(
            {
              ok: true,
              switches: swE as Record<string, unknown>[],
              basicInfo: { switches: swE as Record<string, unknown>[] },
            },
            true
          );
        }
      } else if (device instanceof SonoffSwitch) {
        const sw = p.switches;
        if (Array.isArray(sw) && sw.length > 0) {
          void (device as SonoffSwitch).updateValuesFromPayload(
            { ok: true, basicInfo: { switches: sw as Record<string, unknown>[] } },
            true
          );
        }
      }
    }
  }
}
