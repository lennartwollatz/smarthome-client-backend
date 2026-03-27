import { logger } from "../../../../logger.js";
import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { MatterDeviceController } from "./matterDeviceController.js";
import { MatterEvent } from "./matterEvent.js";
import { MATTERMODULE } from "./matterModule.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";

export class MatterEventStreamManager extends ModuleEventStreamManager<MatterDeviceController, MatterEvent> {

  constructor(managerId: string, controller: MatterDeviceController, deviceManager: DeviceManager) {
    super(managerId, MATTERMODULE.id, controller, deviceManager);
  }

  protected async startEventStream(callback: (event: MatterEvent) => void): Promise<void> {
    let devices = this.deviceManager.getDevicesForModule(MATTERMODULE.id);
    for (const device of devices) {
      try {
        await this.controller.startEventStream(device, callback);
      } catch (err) {
        logger.error({ err, deviceId: device.id }, "Fehler beim Starten des EventStreams für Matter-Gerät");
        // Weiter mit dem nächsten Gerät, Server soll nicht abstürzen
      }
    }
  }

  protected async stopEventStream(): Promise<void> {
    let devices = this.deviceManager.getDevicesForModule(MATTERMODULE.id);
    for (const device of devices) {
      try {
        await this.controller.stopEventStream(device);
      } catch (err) {
        logger.error({ err, deviceId: device.id }, "Fehler beim Stoppen des EventStreams für Matter-Gerät");
        // Weiter mit dem nächsten Gerät, Server soll nicht abstürzen
      }
    }
  }

  protected async handleEvent(event: MatterEvent): Promise<void> {
    const nodeId = event.nodeId ?? event.deviceId;
    const eventName = event.event ?? event.name ?? "unknown";

    if (nodeId != null) {
      const deviceId = `matter-${nodeId}`;
      const device = this.deviceManager.getDevice(deviceId);
      if (device) {
        const payload = event.payload ?? {};
        
        //TODO: auf die events reagieren und die Eigenschaften im device setzen.
        
        this.deviceManager.saveDevice(device);
      }
    }

    logger.debug({ eventName, nodeId }, "Matter Event verarbeitet");
  }
}

