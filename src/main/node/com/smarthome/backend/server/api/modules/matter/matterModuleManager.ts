import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { Device, TemperatureSchedule } from "../../../../model/index.js";
import { MatterDeviceDiscover } from "./matterDeviceDiscover.js";
import { MatterDeviceDiscovered } from "./matterDeviceDiscovered.js";
import { MatterDeviceController } from "./matterDeviceController.js";
import { MatterEventStreamManager } from "./matterEventStreamManager.js";
import { MatterEvent } from "./matterEvent.js";
import { ModuleManager } from "../moduleManager.js";
import { MATTERCONFIG } from "./matterModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { MatterSwitchEnergy } from "./devices/matterSwitchEnergy.js";
import { MatterSwitch } from "./devices/matterSwitch.js";
import { MatterSwitchDimmer } from "./devices/matterSwitchDimmer.js";
import { matterVendors } from "./matterVendors.js";
import { MatterThermostat } from "./devices/matterThermostat.js";
import { ActionManager } from "../../../actions/ActionManager.js";
import { EventManager } from "../../../events/EventManager.js";

export type PairingPayload = {
  pairingCode: string;
};

export class MatterModuleManager extends ModuleManager<MatterEventStreamManager, MatterDeviceController, MatterDeviceController, MatterEvent, Device, MatterDeviceDiscover, MatterDeviceDiscovered> {

  constructor(
    databaseManager: DatabaseManager,
    actionManager: ActionManager,
    eventManager: EventManager
  ) {
    const controller = new MatterDeviceController(databaseManager);
    super(
      databaseManager,
      actionManager,
      eventManager,
      controller,
      new MatterDeviceDiscover(databaseManager)
    );
  }

  
  public getModuleId(): string {
    return MATTERCONFIG.id;
  }
  protected getManagerId(): string {
    return MATTERCONFIG.managerId;
  }

  async discoverDevices(): Promise<MatterDeviceDiscovered[]> {
    try {
      const existingDevices = this.actionManager.getDevicesForModule(this.getModuleId());
      return await this.deviceDiscover.discover(5, existingDevices.map(d => d.id));
    } catch (err) {
      logger.error({ err }, "Fehler bei der Geraeteerkennung");
      return [];
    }
  }

  async pairDevice(
    deviceId: string,
    payload: PairingPayload
  ): Promise<{ success: boolean; nodeId?: string | number | bigint | boolean; deviceId?: string; error?:string}> {
    logger.info({ deviceId }, "Starte Matter Pairing");

    let device = this.deviceDiscover.getStored(deviceId);

    if (!device) {
      return await this.pairDeviceByCode(payload);
    }

    if( device.isPaired ?? false){
      return { success: true, nodeId: device.nodeId, deviceId: deviceId };
    }

    const pairedDevice = await this.deviceController.pairDevice(device, payload);

    if (!pairedDevice) {
      logger.warn({ deviceId }, "Pairing fehlgeschlagen (kein Node zurückgegeben)");
      return { success: false, error: "Pairing fehlgeschlagen (kein Node zurückgegeben)" };
    }
    // Persistenz im Discovered Device: Pairing-/Verbindungsdaten sollen dort liegen (nicht im Device selbst)
    this.deviceDiscover.setStored(deviceId, pairedDevice);


    const matterDevice = await this.toMatterDevice(pairedDevice);
    const saved = this.actionManager.saveDevice(matterDevice);
    if (saved) {
      //this.initialiseEventStreamManager();
    }
    return { success: saved, nodeId: pairedDevice.nodeId ?? undefined, deviceId: matterDevice.id };
  }

  async unpairDevice(deviceId: string): Promise<boolean> {
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return false;
    return this.deviceController.unpairDevice(device as MatterSwitchEnergy | MatterSwitch | MatterSwitchDimmer);
  }

  /**
   * Pairing/Commissioning nur über den Code (ohne vorheriges Discover eines konkreten Geräts).
   * Speichert anschließend ein Device im ActionManager.
   */
  async pairDeviceByCode(
    payload: PairingPayload
  ): Promise<{ success: boolean; nodeId?: string | number | bigint | boolean; deviceId?: string; error?:string }> {
    logger.info("Starte Matter Pairing by Code");
    if (!payload) return { success: false };

    let pairedDevice = await this.deviceController.pairDeviceByCode(payload);
    if (!pairedDevice) {
      return { success: false, error: "Pairing fehlgeschlagen (kein Node zurückgegeben)" };
    }
    // Persistenz im Discovered Device: Pairing-/Verbindungsdaten sollen dort liegen (nicht im Device selbst)
    this.deviceDiscover.setStored(pairedDevice.id, pairedDevice);


    const matterDevice = await this.toMatterDevice(pairedDevice);
    const saved = this.actionManager.saveDevice(matterDevice);
    if (saved) {
      //this.initialiseEventStreamManager();
    }
    return { success: saved, nodeId: pairedDevice.nodeId ?? undefined, deviceId: matterDevice.id };
  }

  protected createEventStreamManager(): MatterEventStreamManager {
    return new MatterEventStreamManager(this.getManagerId(), this.deviceController, this.actionManager);
  }


  private async toMatterDevice(device: MatterDeviceDiscovered) {
    const id = device.id;
    const nodeId = device.nodeId ?? "0";
    const vendorId = device.vendorId ?? undefined;
    const productId = device.productId ?? undefined;
    const vendorInfo = vendorId != null && productId != null
      ? matterVendors.getVendorAndProductName(vendorId, productId)
      : null;

    // Default-Name aus Vendor/Product ableiten (falls verfügbar), ansonsten discovered Name behalten
    const derivedName =
      vendorInfo?.productName
        ? `${vendorInfo.vendorName} ${vendorInfo.productName}`.trim()
        : (device.name ?? "Matter Device");

    const typeFromVendor = toDeviceType(vendorInfo?.deviceType ?? null);

    // Passendes Device instanziieren
    if (typeFromVendor === DeviceType.SWITCH_DIMMER) {
      //get Buttons for Node
      const buttons = await this.deviceController.getButtonsForDevice(device);
      const dimmer = new MatterSwitchDimmer(derivedName, id, nodeId, buttons);
      dimmer.setMatterController(this.deviceController);
      await dimmer.updateValues();
      return dimmer;
    }
    if (typeFromVendor === DeviceType.SWITCH) {
      //get Buttons for Node
      const buttons = await this.deviceController.getButtonsForDevice(device);
      const switchDevice = new MatterSwitch(derivedName, id, nodeId, buttons);
      switchDevice.setMatterController(this.deviceController);
      await switchDevice.updateValues();
      return switchDevice;
    }
    if (typeFromVendor === DeviceType.SWITCH_ENERGY) {
      //get Buttons for Node
      const buttons = await this.deviceController.getButtonsForDevice(device);
      const switchEnergyDevice = new MatterSwitchEnergy(derivedName, id, nodeId, buttons);
      switchEnergyDevice.setMatterController(this.deviceController);
      await switchEnergyDevice.updateValues();
      return switchEnergyDevice;
    }

    if (typeFromVendor === DeviceType.THERMOSTAT) {
      const thermostatDevice = new MatterThermostat(derivedName, id, nodeId);
      thermostatDevice.setMatterController(this.deviceController);
      await thermostatDevice.updateValues();
      return thermostatDevice;
    }

    // Fallback: wenn Vendor/Product unbekannt oder kein Mapping existiert, generisches Device speichern
    return new Device({
      id,
      name: derivedName,
      moduleId: MATTERCONFIG.id,
      isConnected: true
    });
  }

  async convertDeviceFromDatabase(device: Device): Promise<Device | null> {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }

    const deviceType = device.type as DeviceType;
    let convertedDevice: Device | null = null;

    switch (deviceType) {
      case DeviceType.SWITCH_ENERGY:
        const matterSwitchEnergy = new MatterSwitchEnergy();
        Object.assign(matterSwitchEnergy, device);
        matterSwitchEnergy.rehydrateButtons();
        matterSwitchEnergy.setMatterController(this.deviceController);
        await matterSwitchEnergy.updateValues();
        convertedDevice = matterSwitchEnergy;
        break;
      case DeviceType.SWITCH:
        const matterSwitch = new MatterSwitch();
        Object.assign(matterSwitch, device);
        matterSwitch.rehydrateButtons();
        matterSwitch.setMatterController(this.deviceController);
        await matterSwitch.updateValues();
        convertedDevice = matterSwitch;
        break;
      case DeviceType.SWITCH_DIMMER:
        const matterSwitchDimmer = new MatterSwitchDimmer();
        Object.assign(matterSwitchDimmer, device);
        matterSwitchDimmer.rehydrateButtons();
        matterSwitchDimmer.setMatterController(this.deviceController);
        await matterSwitchDimmer.updateValues();
        convertedDevice = matterSwitchDimmer;
        break;
      case DeviceType.THERMOSTAT:
        const matterThermostat = new MatterThermostat();
        Object.assign(matterThermostat, device);
        matterThermostat.setMatterController(this.deviceController);
        await matterThermostat.updateValues();
        convertedDevice = matterThermostat;
        break;
    }

    return convertedDevice;
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.actionManager.getDevicesForModule(this.getModuleId());
    for (const device of devices) {
      if (device instanceof MatterSwitchEnergy) {
          await device.updateValues();
          this.actionManager.saveDevice(device);
      }
      if (device instanceof MatterSwitch) {
          await device.updateValues();
          this.actionManager.saveDevice(device);
      }
      if (device instanceof MatterSwitchDimmer) {
          await device.updateValues();
          this.actionManager.saveDevice(device);
      }
      if (device instanceof MatterThermostat) {
        await device.updateValues();
        this.actionManager.saveDevice(device);
    }
    }
  }

  async toggle(deviceId: string, buttonId:string): Promise<boolean> {
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return false;
    await ( device as MatterSwitchEnergy | MatterSwitch | MatterSwitchDimmer).toggle(buttonId, true, true);
    this.actionManager.saveDevice(device);
    return true;
  }

  async setOn(deviceId: string, buttonId:string): Promise<boolean> {
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return false;
    await ( device as MatterSwitchEnergy | MatterSwitch | MatterSwitchDimmer).on(buttonId, true, true);
    this.actionManager.saveDevice(device);
    return true;
  }

  async setOff(deviceId: string, buttonId:string): Promise<boolean> {
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return false;
    await ( device as MatterSwitchEnergy | MatterSwitch | MatterSwitchDimmer).off(buttonId, true, true);
    this.actionManager.saveDevice(device);
    return true;
  }

  async setIntensity(deviceId: string, buttonId:string, intensity:number): Promise<boolean> {
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return false;
    await (device as MatterSwitchDimmer).setIntensity(buttonId, intensity, true, true);
    this.actionManager.saveDevice(device);
    return true;
  }

  async setTemperatureGoal(deviceId: string, temperatureGoal:number): Promise<boolean> {
    const bounded = Math.max(15, Math.min(30, temperatureGoal));
    const constraintTemperature = Math.round(bounded * 100) / 100;
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return false;
    await ( device as MatterThermostat).setTemperatureGoal(constraintTemperature, true, true);
    this.actionManager.saveDevice(device);
    return true;
  }

  async setTemperatureSchedules(deviceId: string, temperatureSchedules:TemperatureSchedule[]): Promise<boolean> {
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return false;
    await ( device as MatterThermostat).setTemperatureSchedules(temperatureSchedules, true, true);
    this.actionManager.saveDevice(device);
    return true;
  }
}

function toDeviceType(deviceTypeKey: string | null): DeviceType | null {
  if (!deviceTypeKey) return null;
  // `matterVendors.ts` nutzt aktuell i18n Keys wie "device.switch"
  if (deviceTypeKey === "device.switch") return DeviceType.SWITCH;
  if (deviceTypeKey === "device.switch-dimmer") return DeviceType.SWITCH_DIMMER;
  if (deviceTypeKey === "device.switch-energy") return DeviceType.SWITCH_ENERGY;
  if (deviceTypeKey === "device.thermostat") return DeviceType.THERMOSTAT;
  return null;
}

