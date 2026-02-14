import { logger } from "../../../../logger.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { BMWDeviceController } from "./bmwDeviceController.js";
import { BMWEvent } from "./bmwEvent.js";
import { BMWMODULE } from "./bmwModule.js";
import { BMWCar } from "./devices/bmwCar.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";

export class BMWEventStreamManager extends ModuleEventStreamManager<BMWDeviceController, BMWEvent> {
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLLING_INTERVAL_MS = 60000;

  constructor(
    managerId: string,
    moduleId: string,
    controller: BMWDeviceController,
    actionManager: ActionManager
  ) {
    super(managerId, moduleId, controller, actionManager);
  }

  protected async startEventStream(callback: (event: BMWEvent) => void): Promise<void> {
    this.stopPolling();
    this.pollingInterval = setInterval(async () => {
      await this.pollAllCars(callback);
    }, this.POLLING_INTERVAL_MS);
    await this.pollAllCars(callback);
    logger.info("BMW EventStream gestartet (Polling alle 60s)");
  }

  protected async stopEventStream(): Promise<void> {
    this.stopPolling();
    logger.info("BMW EventStream gestoppt");
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async pollAllCars(callback: (event: BMWEvent) => void): Promise<void> {
    const devices = this.actionManager.getDevices();
    for (const device of devices) {
      if (device.moduleId !== BMWMODULE.id) continue;
      if (device.type !== DeviceType.CAR) continue;
      if (!(device instanceof BMWCar)) continue;
      const before = JSON.stringify({
        fuelLevelPercent: device.fuelLevelPercent,
        rangeKm: device.rangeKm,
        mileageKm: device.mileageKm,
        lockedState: device.lockedState,
        inUseState: device.inUseState,
        climateControlState: device.climateControlState,
        location: device.location,
        windows: device.windows,
        doors: device.doors
      });
      await device.updateValues();
      const after = JSON.stringify({
        fuelLevelPercent: device.fuelLevelPercent,
        rangeKm: device.rangeKm,
        mileageKm: device.mileageKm,
        lockedState: device.lockedState,
        inUseState: device.inUseState,
        climateControlState: device.climateControlState,
        location: device.location,
        windows: device.windows,
        doors: device.doors
      });
      if (before !== after && device.id) {
        callback({
          deviceid: device.id,
          data: {
            type: "StatusChanged",
            value: {
              fuelLevelPercent: device.fuelLevelPercent,
              rangeKm: device.rangeKm,
              mileageKm: device.mileageKm,
              lockedState: device.lockedState,
              inUseState: device.inUseState,
              climateControlState: device.climateControlState
            }
          }
        });
      }
    }
  }

  protected async handleEvent(event: BMWEvent): Promise<void> {
    if (!event.deviceid || !event.data) return;
    const device = this.actionManager.getDevice(event.deviceid);
    if (!device || !(device instanceof BMWCar)) return;
    if (event.data.type === "StatusChanged") {
      this.actionManager.saveDevice(device);
    }
  }
}

