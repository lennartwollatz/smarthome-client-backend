import { Device } from "../../../../../model/devices/Device.js";
import { HeosController } from "../heosController.js";
import { HeosDiscoveredDevice } from "../heosDiscoveredDevice.js";
import { HeosSpeaker } from "../heosSpeaker.js";

export class DenonSpeaker extends HeosSpeaker {
  constructor();
  constructor(name: string, id: string, address: string, pid: number, heos: HeosController);
  constructor(device: Device, discoveredDevice: HeosDiscoveredDevice, heos: HeosController);
  constructor(
    nameOrDevice?: string | Device,
    idOrDiscovered?: string | HeosDiscoveredDevice,
    addressOrHeos?: string | HeosController,
    pid?: number,
    heos?: HeosController
  ) {
    if (typeof nameOrDevice === "string") {
      super(nameOrDevice, idOrDiscovered as string, addressOrHeos as string, pid ?? 0, heos ?? new HeosController());
    } else if (nameOrDevice && idOrDiscovered && addressOrHeos) {
      const device = nameOrDevice as Device;
      const discoveredDevice = idOrDiscovered as HeosDiscoveredDevice;
      const controller = addressOrHeos as HeosController;
      super(
        device.name ?? "",
        discoveredDevice.udn,
        discoveredDevice.address,
        discoveredDevice.pid ?? 0,
        controller
      );
      this.room = device.room;
      this.icon = device.icon;
    } else {
      super();
    }
    this.moduleId = "denon";
  }
}

