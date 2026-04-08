import type { DatabaseManager } from "../../../db/database.js";
import type { EventManager } from "../../../events/EventManager.js";
import { Device } from "../../../../model/devices/Device.js";
import { DEFAULT_WEATHER_DEVICE_ID, DeviceWeather } from "../../../../model/devices/DeviceWeather.js";
import { WeatherDeviceController } from "./weatherDeviceController.js";
import { WeatherDeviceDiscover } from "./weatherDeviceDiscover.js";
import { WeatherDeviceDiscovered } from "./weatherDeviceDiscovered.js";
import { WeatherEventStreamManager } from "./weatherEventStreamManager.js";
import { WeatherEvent } from "./weatherEvent.js";
import { ModuleManager } from "../moduleManager.js";
import { WEATHERCONFIG, WEATHERMODULE } from "./weatherModule.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { WeatherDevice } from "./devices/WeatherDevice.js";

export class WeatherModuleManager extends ModuleManager<
  WeatherEventStreamManager,
  WeatherDeviceController,
  WeatherDeviceController,
  WeatherEvent,
  DeviceWeather,
  WeatherDeviceDiscover,
  WeatherDeviceDiscovered
> {
  constructor(
    databaseManager: DatabaseManager,
    deviceManager: DeviceManager,
    eventManager: EventManager
  ) {
    super(
      databaseManager,
      deviceManager,
      eventManager,
      new WeatherDeviceController(),
      new WeatherDeviceDiscover(databaseManager)
    );
  }

  protected createEventStreamManager(): WeatherEventStreamManager {
    return new WeatherEventStreamManager(
      this.getManagerId(),
      this.deviceController,
      this.deviceManager
    );
  }

  public getModuleId(): string {
    return WEATHERCONFIG.id;
  }

  protected getManagerId(): string {
    return WEATHERCONFIG.managerId;
  }

  async convertDeviceFromDatabase(device: Device): Promise<Device | null> {
    if (device.moduleId !== WEATHERMODULE.id) return null;
    return new WeatherDevice(device);
  }

  async initializeDeviceControllers(): Promise<void> {
    const device = this.deviceManager.getDevice(DEFAULT_WEATHER_DEVICE_ID);
    if (device instanceof WeatherDevice && device.moduleId === WEATHERMODULE.id) {
      device.setWeatherController(this.deviceController);
    }
  }
}
