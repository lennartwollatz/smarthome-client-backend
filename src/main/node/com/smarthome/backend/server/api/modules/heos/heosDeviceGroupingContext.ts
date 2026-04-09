import type { Device } from "../../../../model/devices/Device.js";
import type { DeviceManager } from "../../entities/devices/deviceManager.js";

/**
 * Laufzeit-Kontext für HEOS-Gruppierung (Peer-Auflösung), absichtlich nicht am Device gespeichert,
 * damit {@link JSON.stringify} beim DB-Speichern keine Zyklen über DeviceManager/LiveUpdate auslöst.
 */
const groupingDeviceManagerByDevice = new WeakMap<Device, DeviceManager>();

export function setHeosDeviceGroupingContext(device: Device, dm: DeviceManager | undefined): void {
  if (dm === undefined) {
    groupingDeviceManagerByDevice.delete(device);
  } else {
    groupingDeviceManagerByDevice.set(device, dm);
  }
}

export function getHeosDeviceGroupingContext(device: Device): DeviceManager | undefined {
  return groupingDeviceManagerByDevice.get(device);
}
