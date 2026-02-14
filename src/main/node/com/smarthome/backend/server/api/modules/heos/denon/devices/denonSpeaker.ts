import { Device } from "../../../../../../model/devices/Device.js";
import { HeosDeviceController } from "../../heosDeviceController.js";
import { HeosDeviceDiscovered } from "../../heosDeviceDiscovered.js";
import { HeosSpeaker } from "../../devices/heosSpeaker.js";

export class DenonSpeaker extends HeosSpeaker {
  constructor();
  constructor(name: string, id: string, address: string, pid: number, heos: HeosDeviceController);
  constructor(device: Device, discoveredDevice: HeosDeviceDiscovered, heos: HeosDeviceController);
  constructor(
    nameOrDevice?: string | Device,
    idOrDiscovered?: string | HeosDeviceDiscovered,
    addressOrHeos?: string | HeosDeviceController,
    pid?: number,
    heos?: HeosDeviceController
  ) {
    if (typeof nameOrDevice === "string") {
      super(nameOrDevice, idOrDiscovered as string, addressOrHeos as string, pid ?? 0, heos ?? new HeosDeviceController());
    } else if (nameOrDevice && idOrDiscovered && addressOrHeos) {
      const device = nameOrDevice as Device;
      const discoveredDevice = idOrDiscovered as HeosDeviceDiscovered;
      const controller = addressOrHeos as HeosDeviceController;
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

