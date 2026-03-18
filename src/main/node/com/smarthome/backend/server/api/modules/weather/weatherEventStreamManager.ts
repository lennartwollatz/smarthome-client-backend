import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { WeatherDeviceController } from "./weatherDeviceController.js";
import { WeatherEvent } from "./weatherEvent.js";
import { WEATHERMODULE } from "./weatherModule.js";
import { DeviceWeather } from "../../../../model/devices/DeviceWeather.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import type { ActionManager } from "../../../actions/ActionManager.js";
import { logger } from "../../../../logger.js";

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 Minuten

export class WeatherEventStreamManager extends ModuleEventStreamManager<WeatherDeviceController, WeatherEvent> {
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(managerId: string, controller: WeatherDeviceController, actionManager: ActionManager) {
    super(managerId, WEATHERMODULE.id, controller, actionManager);
  }

  protected handleEvent(event: WeatherEvent): void {
    return;
  }

  protected async startEventStream(callback: (event: WeatherEvent) => void): Promise<void> {
    const devices = this.actionManager.getDevicesForModule(WEATHERMODULE.id);
    const weatherDevices = devices.filter(
      (d): d is DeviceWeather => d?.type === DeviceType.WEATHER
    );

    if (weatherDevices.length === 0) {
      logger.debug("Weather EventStream: Keine Weather-Devices, Polling wird übersprungen");
      return;
    }

    const poll = async () => {
      const currentDevices = this.actionManager.getDevicesForModule(WEATHERMODULE.id).filter(
        (d): d is DeviceWeather => d?.type === DeviceType.WEATHER
      );
      for (const device of currentDevices) {
        if (typeof device.latitude !== "number" || typeof device.longitude !== "number") {
          logger.debug({ deviceId: device.id }, "Weather Device ohne Koordinaten, überspringe");
          continue;
        }
        try {
          const success = await this.controller.fetchWeather(device);
          if (success) {
            this.actionManager.saveDevice(device);
            callback({
              deviceid: device.id!,
              data: { type: "weather.updated", value: device }
            });
          }
        } catch (err) {
          logger.error({ err, deviceId: device.id }, "Fehler beim Weather-API-Abruf");
        }
      }
    };

    await poll();
    this.pollIntervalId = setInterval(poll, POLL_INTERVAL_MS);
    logger.info({ intervalMinutes: 30 }, "Weather EventStream gestartet (halbstündliches Polling)");
  }

  protected async stopEventStream(): Promise<void> {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }
}
