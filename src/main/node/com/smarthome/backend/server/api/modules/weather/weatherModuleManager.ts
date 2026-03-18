import type { DatabaseManager } from "../../../db/database.js";
import type { ActionManager } from "../../../actions/ActionManager.js";
import type { EventManager } from "../../../events/EventManager.js";
import { Device } from "../../../../model/devices/Device.js";
import { DeviceWeather } from "../../../../model/devices/DeviceWeather.js";
import { WeatherDeviceController } from "./weatherDeviceController.js";
import { WeatherDeviceDiscover } from "./weatherDeviceDiscover.js";
import { WeatherDeviceDiscovered } from "./weatherDeviceDiscovered.js";
import { WeatherEventStreamManager } from "./weatherEventStreamManager.js";
import { WeatherEvent } from "./weatherEvent.js";
import { ModuleManager } from "../moduleManager.js";
import { WEATHERCONFIG, WEATHERMODULE } from "./weatherModule.js";

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
    actionManager: ActionManager,
    eventManager: EventManager
  ) {
    super(
      databaseManager,
      actionManager,
      eventManager,
      new WeatherDeviceController(eventManager),
      new WeatherDeviceDiscover(databaseManager)
    );
  }

  protected createEventStreamManager(): WeatherEventStreamManager {
    return new WeatherEventStreamManager(
      this.getManagerId(),
      this.deviceController,
      this.actionManager
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
    return new DeviceWeather(device);
  }

  async initializeDeviceControllers(): Promise<void> {
    // Keine Controller-Referenz auf den Devices nötig – EventStream nutzt Controller direkt
  }

  async refreshDevice(deviceId: string): Promise<boolean> {
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== WEATHERMODULE.id || device.type !== "weather") {
      return false;
    }
    const success = await this.deviceController.fetchWeather(device as DeviceWeather);
    if (success) {
      this.actionManager.saveDevice(device);
    }
    return success;
  }
}
