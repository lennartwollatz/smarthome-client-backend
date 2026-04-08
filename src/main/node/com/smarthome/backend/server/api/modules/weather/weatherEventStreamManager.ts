import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { WeatherDeviceController } from "./weatherDeviceController.js";
import { WeatherEvent } from "./weatherEvent.js";
import { WEATHERMODULE } from "./weatherModule.js";
import { DEFAULT_WEATHER_DEVICE_ID } from "../../../../model/devices/DeviceWeather.js";
import { logger } from "../../../../logger.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { WeatherDevice } from "./devices/WeatherDevice.js";

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 Minuten

export class WeatherEventStreamManager extends ModuleEventStreamManager<WeatherDeviceController, WeatherEvent> {
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(managerId: string, controller: WeatherDeviceController, deviceManager: DeviceManager) {
    super(managerId, WEATHERMODULE.id, controller, deviceManager);
  }

  protected handleEvent(event: WeatherEvent): void {
    if (event.deviceid !== DEFAULT_WEATHER_DEVICE_ID) {
      return;
    }
    const device = this.deviceManager.getDevice(event.deviceid);
    if(!device) return;
    (device as WeatherDevice).updateValuesFromPayload(event.data, true);
    this.deviceManager.saveDevice(device);
  }

  protected async startEventStream(callback: (event: WeatherEvent) => void): Promise<void> {
    const device = this.deviceManager.getDevice(DEFAULT_WEATHER_DEVICE_ID) as WeatherDevice | undefined;
    if (!device || device.moduleId !== WEATHERMODULE.id) {
      logger.debug("Weather EventStream: Kein zentrales Weather-Gerät, Polling wird übersprungen");
      return;
    }

    const poll = async () => {
      const current = this.deviceManager.getDevice(DEFAULT_WEATHER_DEVICE_ID) as WeatherDevice | undefined;
      if (!current || current.moduleId !== WEATHERMODULE.id) {
        return;
      }
      try {
        const data = await this.controller.fetchWeather(current);
        if (!data) return;
        callback({
          deviceid: DEFAULT_WEATHER_DEVICE_ID,
          data,
        });
      } catch (err) {
        logger.error({ err, deviceId: DEFAULT_WEATHER_DEVICE_ID }, "Fehler beim Weather-API-Abruf");
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
