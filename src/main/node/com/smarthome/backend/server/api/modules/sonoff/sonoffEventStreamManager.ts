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
import { normalizeSonoffSwitchLanPayload } from "./devices/sonoffSwitchLanPayload.js";

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
   * Live-Zeilen von pysonofflanr3 ``getState`` ins Modell:
   *
   * - **Schalter-LAN:** ``{ switches, ssid, bssid }`` (ggf. in größerem JSON / ``basicInfo``).
   * - **Leistung flach:** ``{ actPow_01, …, ssid, bssid }`` ohne ``ok``.
   * - **Statistics-HTTP:** ``{ ok, endpoint: "statistics", data: { … } }``.
   */
  private applySonoffStreamPayloadToDevice(device: Device, payload: Record<string, unknown>): void {
    const endpoint = typeof payload.endpoint === "string" ? payload.endpoint : "";

    if (payload.ok === true && endpoint === "statistics" && payload.data !== undefined) {
      if (device instanceof SonoffSwitchEnergy) {
        void (device as SonoffSwitchEnergy).updateStatisticsFromPayload(payload, true);
      }
      return;
    }

    if (device instanceof SonoffSwitchEnergy && payload.ok === true) {
      const stats = payload.statistics as Record<string, unknown> | undefined;
      if (stats?.ok === true && typeof stats.data === "object" && stats.data !== null) {
        void (device as SonoffSwitchEnergy).updateStatisticsFromPayload(stats, true);
      }
    }

    const lanSwitch = normalizeSonoffSwitchLanPayload(payload);
    if (lanSwitch !== null) {
      if (device instanceof SonoffSwitch) {
        (device as SonoffSwitch).updateValuesFromPayload(payload, true);
        return;
      }
      if (device instanceof SonoffSwitchEnergy) {
        (device as SonoffSwitchEnergy).updateValuesFromPayload(payload, true);
      }
    }

    if (payload.ok === true && (payload.basicInfo !== undefined || payload.switch !== undefined)) {
      if (device instanceof SonoffSwitchDimmer) {
        (device as SonoffSwitchDimmer).updateValuesFromPayload(payload, true);
      } else if (device instanceof SonoffSwitch) {
        (device as SonoffSwitch).updateValuesFromPayload(payload, true);
      }
      return;
    }

    if (payload.ok === undefined || payload.ok === null) {
      const p = payload as Record<string, unknown>;
      if (device instanceof SonoffSwitchEnergy && this.payloadHasSonoffEnergyMetrics(p)) {
        void (device as SonoffSwitchEnergy).updateStatisticsFromPayload({ ok: true, data: p }, true);
      }
    }
  }

  private payloadHasSonoffEnergyMetrics(p: Record<string, unknown>): boolean {
    return Object.keys(p).some(
      k =>
        k.startsWith("actPow_") ||
        k.startsWith("current_") ||
        k.startsWith("voltage_") ||
        k.startsWith("reactPow_") ||
        k.startsWith("apparentPow_")
    );
  }
}
