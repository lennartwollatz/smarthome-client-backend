import { logger } from "../../../../logger.js";
import type { ActionManager } from "../../entities/actions/ActionManager.js";
import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { XiaomiVacuumCleaner } from "./devices/xiaomiVacuumCleaner.js";
import { XiaomiDeviceController } from "./xiaomiDeviceController.js";
import { XiaomiEvent } from "./xiaomiEvent.js";
import { XIAOMIMODULE } from "./xiaomiModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";

export class XiaomiEventStreamManager extends ModuleEventStreamManager<XiaomiDeviceController, XiaomiEvent> {

  constructor(managerId: string, controller: XiaomiDeviceController, deviceManager: DeviceManager) {
    super(managerId, XIAOMIMODULE.id, controller, deviceManager);
  }

  protected async startEventStream(callback: (event: XiaomiEvent) => void): Promise<void> {
    let devices = this.deviceManager.getDevices();
    for (const device of devices) {
      if (device.moduleId === XIAOMIMODULE.id && device.type === DeviceType.VACUUM) {
        await this.controller.startEventStream(device as XiaomiVacuumCleaner, callback);
      }
    }
  }

  protected async stopEventStream(): Promise<void> {
    let devices = this.deviceManager.getDevices();
    for (const device of devices) {
      if (device.moduleId === XIAOMIMODULE.id && device.type === DeviceType.VACUUM) {
        await this.controller.stopEventStream(device as XiaomiVacuumCleaner);
      }
    }
  }

  protected async handleEvent(event: XiaomiEvent): Promise<void> {
    if (!event.deviceid || !event.data) {
      return;
    }

    const device = this.deviceManager.getDevice(event.deviceid);
    if (!device || !(device instanceof XiaomiVacuumCleaner)) {
      return;
    }
    await device.setUpdatedData(event.data, true);
    this.deviceManager.saveDevice(device);
  }
}

