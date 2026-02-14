import { logger } from "../../../../logger.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { XiaomiVacuumCleaner } from "./devices/xiaomiVacuumCleaner.js";
import { XiaomiDeviceController } from "./xiaomiDeviceController.js";
import { XiaomiEvent } from "./xiaomiEvent.js";
import { XIAOMIMODULE } from "./xiaomiModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";

export class XiaomiEventStreamManager extends ModuleEventStreamManager<XiaomiDeviceController, XiaomiEvent> {

  constructor(managerId: string, controller: XiaomiDeviceController, actionManager: ActionManager) {
    super(managerId, XIAOMIMODULE.id, controller, actionManager);
  }

  protected async startEventStream(callback: (event: XiaomiEvent) => void): Promise<void> {
    let devices = this.actionManager.getDevices();
    for (const device of devices) {
      if (device.moduleId === XIAOMIMODULE.id && device.type === DeviceType.VACUUM) {
        await this.controller.startEventStream(device as XiaomiVacuumCleaner, callback);
      }
    }
  }

  protected async stopEventStream(): Promise<void> {
    let devices = this.actionManager.getDevices();
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

    logger.debug("handleEvent: " + JSON.stringify(event.data));
    
    // Parse the event data structure
    const eventData = event.data;
    switch (eventData.type) {
      case 'Status':
        if (typeof eventData.value === 'object') {
          await this.handleStatusChange(event.deviceid, eventData.value as Record<string, unknown>);
        }
        break;
      case 'State':
        if (typeof eventData.value === 'string') {
          await this.handleStateChange(event.deviceid, eventData.value);
        }
        break;
      default:
        logger.debug({ deviceId: event.deviceid, eventType: eventData.type }, "Unbehandeltes Event");
    }
  }

  private async handleStatusChange(deviceId: string, status: Record<string, unknown>) {
    try {
      const device = this.actionManager.getDevice(deviceId);
      if (!device || !(device instanceof XiaomiVacuumCleaner)) {
        return;
      }

      // Update device status based on event data
      // TODO: Implement specific status updates based on MiIO protocol
      logger.debug({ deviceId, status }, "Status aktualisiert");
      this.actionManager.saveDevice(device);
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Verarbeiten von Status-Aenderung");
    }
  }

  private async handleStateChange(deviceId: string, state: string) {
    try {
      const device = this.actionManager.getDevice(deviceId);
      if (!device || !(device instanceof XiaomiVacuumCleaner)) {
        return;
      }

      // Update device state based on event data
      // TODO: Implement specific state updates based on MiIO protocol
      logger.debug({ deviceId, state }, "State aktualisiert");
      this.actionManager.saveDevice(device);
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Verarbeiten von State-Aenderung");
    }
  }
}

