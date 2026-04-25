import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { Device } from "../../../../model/devices/Device.js";
import type { TemperatureSchedule } from "../../../../model/devices/DeviceThermostat.js";
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
import { EventManager } from "../../../events/EventManager.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { MatterVirtualDeviceManager } from "./MatterVirtualDeviceManager.js";
import { VoiceAssistantTrigger } from "../../entities/actions/action/VoiceAssistantTrigger.js";
import { VoiceAssistantCommandAction, VA_MATTER_BTN_ONOFF } from "./voiceAssistantCommandMapping.js";
import type { MatterSwitchTargetBinding } from "./matterSwitchBindingTypes.js";
import { ActionManager } from "../../entities/actions/ActionManager.js";
import { UserManager } from "../../entities/users/userManager.js";
import { MatterSwitchBindingManager } from "./matterSwitchBindingManager.js";
import { setMatterSwitchTargetNotify } from "../../ports/matterSwitchBindingPort.js";

function matterPairingLanIpv4(address: string | undefined): string | undefined {
  const s = (address ?? "").trim();
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(s) ? s : undefined;
}

function setMatterDeviceLanIpv4(device: Device, discovered: MatterDeviceDiscovered): void {
  const ip = matterPairingLanIpv4(discovered.address);
  if (ip) device.lanIpv4 = ip;
}

export type PairingPayload = {
  pairingCode: string;
};

export class MatterModuleManager extends ModuleManager<MatterEventStreamManager, MatterDeviceController, MatterDeviceController, MatterEvent, Device, MatterDeviceDiscover, MatterDeviceDiscovered> {
  private virtualDeviceManager: MatterVirtualDeviceManager;
  private matterSwitchBindingManager: MatterSwitchBindingManager;

  constructor(
    databaseManager: DatabaseManager,
    deviceManager: DeviceManager,
    eventManager: EventManager,
    actionManager: ActionManager,
    userManager: UserManager
  ) {
    super(
      databaseManager,
      deviceManager,
      eventManager,
      new MatterDeviceController(databaseManager),
      new MatterDeviceDiscover(databaseManager)
    );
    this.virtualDeviceManager = new MatterVirtualDeviceManager(databaseManager, deviceManager, userManager, eventManager);
    this.matterSwitchBindingManager = new MatterSwitchBindingManager(
      databaseManager,
      deviceManager,
      () => this.virtualDeviceManager,
      eventManager
    );
    setMatterSwitchTargetNotify((deviceId, methodName, values) => {
      this.matterSwitchBindingManager.onTargetDeviceAction(deviceId, methodName, values);
    });
    this.virtualDeviceManager.setMatterUserToggleHandler((matterDeviceId, buttonId, isOn) => {
      this.matterSwitchBindingManager.onMatterUserToggle(matterDeviceId, buttonId, isOn);
    });
    actionManager.setMatterModuleManager(this);
    userManager.setMatterModuleManager(this);
  }

  protected createEventStreamManager(): MatterEventStreamManager {
    return new MatterEventStreamManager(this.getManagerId(), this.deviceController, this.deviceManager);
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.deviceManager.getDevicesForModule(this.getModuleId());
    for (const device of devices) {
      if (device instanceof MatterSwitchEnergy) {
        device.setMatterController(this.deviceController);
      }
      if (device instanceof MatterSwitch) {
        device.setMatterController(this.deviceController);
        if (device.isVirtualMatterHost) {
          const id = device.id;
          device.setVirtualMatterHostExecutor({
            setState: (buttonId, on) => this.virtualDeviceManager.hostSwitchSetEndpointState(id, buttonId, on),
          });
        } else {
          device.setVirtualMatterHostExecutor(undefined);
        }
      }
      if (device instanceof MatterSwitchDimmer) {
        device.setMatterController(this.deviceController);
      }
      if (device instanceof MatterThermostat) {
        device.setMatterController(this.deviceController);
      }
    }
    /** VA-Geräte (Modul `voice-assistant`): Roh-JSON → {@link MatterSwitch}, Executor für On/Off-Endpunkt */
    const VA_MODULE_ID = "voice-assistant";
    for (const device of this.deviceManager.getDevices()) {
      let sw: MatterSwitch | null = null;
      if (device instanceof MatterSwitch) {
        sw = device;
      } else if (device.moduleId === VA_MODULE_ID && device.type === DeviceType.SWITCH) {
        const raw = device as Device & Record<string, unknown>;
        const buttonIds = raw.buttons ? Object.keys(raw.buttons as object) : [VA_MATTER_BTN_ONOFF];
        const nodeId = String((raw as { nodeId?: string }).nodeId ?? "0");
        const rebuilt = new MatterSwitch(
          device.name,
          device.id,
          nodeId,
          buttonIds,
          { moduleId: VA_MODULE_ID, isVoiceAssistantDevice: true, quickAccess: Boolean(raw.quickAccess) }
        );
        Object.assign(rebuilt, raw);
        rebuilt.rehydrateButtons();
        this.deviceManager.saveDevice(rebuilt);
        sw = rebuilt;
      }
      if (!sw) continue;
      if (sw.isVirtualMatterHost) continue;
      if (!sw.isVoiceAssistantDevice()) continue;
      const id = sw.id;
      sw.setMatterController(this.deviceController);
      sw.setVirtualMatterHostExecutor({
        setState: (buttonId, on) => this.virtualDeviceManager.vaSwitchSetEndpointState(id, buttonId, on),
      });
    }
  }

  getMatterSwitchBinding(matterDeviceId: string): MatterSwitchTargetBinding | null {
    return this.matterSwitchBindingManager.getBinding(matterDeviceId);
  }

  getAllMatterSwitchBindings(): MatterSwitchTargetBinding[] {
    return this.matterSwitchBindingManager.getAllBindings();
  }

  saveMatterSwitchTargetBinding(
    body: MatterSwitchTargetBinding
  ): { success: true; binding: MatterSwitchTargetBinding } | { success: false; error: string } {
    return this.matterSwitchBindingManager.saveBinding(body);
  }

  removeMatterSwitchTargetBinding(matterDeviceId: string): boolean {
    return this.matterSwitchBindingManager.deleteBinding(matterDeviceId);
  }

  public getModuleId(): string {
    return MATTERCONFIG.id;
  }

  protected getManagerId(): string {
    return MATTERCONFIG.managerId;
  }

  async createPresenceDeviceForUser(userId: string): Promise<{ nodeId: string; port: number; pairingCode: string; passcode: number; discriminator: number; presenceDeviceId: string }> {
    return await this.virtualDeviceManager.createPresenceDevice(userId);
  }

  async removePresenceDeviceForUser(userId: string): Promise<boolean> {
    return await this.virtualDeviceManager.removePresenceDevice(userId);
  }

  async setUserPresent(userId: string): Promise<boolean> {
    return await this.virtualDeviceManager.setUserPresent(userId);
  }

  async setUserAbsent(userId: string): Promise<boolean> {
    return await this.virtualDeviceManager.setUserAbsent(userId);
  }

  async createVoiceAssistantDevice(trimmed: string, actionType: VoiceAssistantCommandAction | undefined, deviceId: string | undefined): Promise<VoiceAssistantTrigger | null> {
    return await this.virtualDeviceManager.createVoiceAssistantDevice(trimmed, actionType, deviceId);
  }

  async removeVoiceAssistantDevice(deviceId: string): Promise<boolean> {
    return await this.virtualDeviceManager.removeVoiceAssistantDevice(deviceId);
  }

  async createMatterHostSwitch(name: string): Promise<{
    deviceId: string;
    pairingCode: string;
    qrPairingCode: string;
    port: number;
  } | null> {
    return await this.virtualDeviceManager.createMatterHostSwitch(name);
  }

  override async prepareRemoveDevice(deviceId: string): Promise<void> {
    const d = this.deviceManager.getDevice(deviceId);
    if (d instanceof MatterSwitch && d.isVirtualMatterHost) {
      await this.virtualDeviceManager.removeMatterHostSwitch(deviceId);
    }
  }


  async discoverDevices(): Promise<MatterDeviceDiscovered[]> {
    try {
      const existingDevices = this.deviceManager.getDevicesForModule(this.getModuleId());
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
    const saved = this.deviceManager.saveDevice(matterDevice);
    if (saved) {
      //this.initialiseEventStreamManager();
    }
    return { success: saved, nodeId: pairedDevice.nodeId ?? undefined, deviceId: matterDevice.id };
  }

  async unpairDevice(deviceId: string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
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
    const saved = this.deviceManager.saveDevice(matterDevice);
    if (saved) {
      //this.initialiseEventStreamManager();
    }
    return { success: saved, nodeId: pairedDevice.nodeId ?? undefined, deviceId: matterDevice.id };
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
      setMatterDeviceLanIpv4(dimmer, device);
      dimmer.setMatterController(this.deviceController);
      await dimmer.updateValues();
      return dimmer;
    }
    if (typeFromVendor === DeviceType.SWITCH) {
      //get Buttons for Node
      const buttons = await this.deviceController.getButtonsForDevice(device);
      const switchDevice = new MatterSwitch(derivedName, id, nodeId, buttons);
      setMatterDeviceLanIpv4(switchDevice, device);
      switchDevice.setMatterController(this.deviceController);
      await switchDevice.updateValues();
      return switchDevice;
    }
    if (typeFromVendor === DeviceType.SWITCH_ENERGY) {
      //get Buttons for Node
      const buttons = await this.deviceController.getButtonsForDevice(device);
      const switchEnergyDevice = new MatterSwitchEnergy(derivedName, id, nodeId, buttons);
      setMatterDeviceLanIpv4(switchEnergyDevice, device);
      switchEnergyDevice.setMatterController(this.deviceController);
      await switchEnergyDevice.updateValues();
      return switchEnergyDevice;
    }

    if (typeFromVendor === DeviceType.THERMOSTAT) {
      const thermostatDevice = new MatterThermostat(derivedName, id, nodeId);
      setMatterDeviceLanIpv4(thermostatDevice, device);
      thermostatDevice.setMatterController(this.deviceController);
      await thermostatDevice.updateValues();
      return thermostatDevice;
    }

    // Fallback: wenn Vendor/Product unbekannt oder kein Mapping existiert, generisches Device speichern
    const fallback = new Device({
      id,
      name: derivedName,
      moduleId: MATTERCONFIG.id,
      isConnected: true
    });
    setMatterDeviceLanIpv4(fallback, device);
    return fallback;
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



  async toggle(deviceId: string, buttonId:string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    await ( device as MatterSwitchEnergy | MatterSwitch | MatterSwitchDimmer).toggle(buttonId, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }

  async setOn(deviceId: string, buttonId:string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    await ( device as MatterSwitchEnergy | MatterSwitch | MatterSwitchDimmer).on(buttonId, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }

  async setOff(deviceId: string, buttonId:string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    await ( device as MatterSwitchEnergy | MatterSwitch | MatterSwitchDimmer).off(buttonId, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }

  async setIntensity(deviceId: string, buttonId:string, intensity:number): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    await (device as MatterSwitchDimmer).setBrightness(buttonId, intensity, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }

  async setTemperatureGoal(deviceId: string, temperatureGoal:number): Promise<boolean> {
    const bounded = Math.max(15, Math.min(30, temperatureGoal));
    const constraintTemperature = Math.round(bounded * 100) / 100;
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    await ( device as MatterThermostat).setTemperatureGoal(constraintTemperature, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }

  async setTemperatureSchedules(deviceId: string, temperatureSchedules:TemperatureSchedule[]): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    await ( device as MatterThermostat).setTemperatureSchedules(temperatureSchedules, true, true);
    this.deviceManager.saveDevice(device);
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

