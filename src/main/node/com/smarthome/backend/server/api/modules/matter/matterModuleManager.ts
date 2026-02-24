import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { Device } from "../../../../model/index.js";
import { MatterDeviceDiscover } from "./matterDeviceDiscover.js";
import { MatterDeviceDiscovered } from "./matterDeviceDiscovered.js";
import { MatterDeviceController } from "./matterDeviceController.js";
import { MatterEventStreamManager } from "./matterEventStreamManager.js";
import { MatterEvent } from "./matterEvent.js";
import { ModuleManager } from "../moduleManager.js";
import { EventStreamManager } from "../../../events/eventStreamManager.js";
import { MATTERCONFIG } from "./matterModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { MatterSwitchEnergy } from "./devices/matterSwitchEnergy.js";
import { MatterSwitch } from "./devices/matterSwitch.js";
import { MatterSwitchDimmer } from "./devices/matterSwitchDimmer.js";
import { matterVendors } from "./matterVendors.js";

export type PairingPayload = {
  pairingCode: string;
};

export class MatterModuleManager extends ModuleManager<MatterEventStreamManager, MatterDeviceController, MatterDeviceController, MatterEvent, Device, MatterDeviceDiscover, MatterDeviceDiscovered> {

  constructor(
    databaseManager: DatabaseManager,
    actionManager: ActionManager,
    eventStreamManager: EventStreamManager
  ) {
    const controller = new MatterDeviceController(databaseManager);
    super(
      databaseManager,
      actionManager,
      eventStreamManager,
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
      return await this.pairDeviceByCode(payload.pairingCode);
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
      this.initialiseEventStreamManager();
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
    pairingCode: string
  ): Promise<{ success: boolean; nodeId?: string | number; deviceId?: string }> {
    logger.info("Starte Matter Pairing by Code");
    if (!pairingCode?.trim()) return { success: false };

    const result = await this.deviceController.pairDeviceByCode(pairingCode.trim());
    if (!result) return { success: false };

    const nodeId = this.extractNodeId(result);
    const nodeIdStr = typeof nodeId === "number" ? String(nodeId) : String(nodeId ?? "");
    const deviceId = nodeIdStr ? `matter-${nodeIdStr}` : undefined;

    // Wir haben (noch) keine Vendor/Product Infos -> generisches Device
    const saved = deviceId
      ? this.actionManager.saveDevice(new Device({ id: deviceId, name: "Matter Device", moduleId: "matter", isConnected: true }))
      : false;

    if (saved && deviceId) {
      // minimalen Discovered-Record anlegen, damit später Metadaten ergänzt werden können
      this.deviceDiscover.upsertStored(deviceId, { id: deviceId, name: "Matter Device", address: "", port: 5540, isCommissionable: false, isOperational: true, lastSeenAt: Date.now(), nodeId: nodeIdStr || undefined, pairedAt: Date.now() } as any);
      this.initialiseEventStreamManager();
    }

    return { success: saved, nodeId: nodeId ?? undefined, deviceId };
  }

  protected createEventStreamManager(): MatterEventStreamManager {
    return new MatterEventStreamManager(this.getManagerId(), this.deviceController, this.actionManager);
  }


  private extractNodeId(value: unknown): string | number | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const nodeId = record.nodeId ?? record.nodeID ?? record.id;
    if (typeof nodeId === "bigint") {
      // Matter NodeId ist runtime meist ein bigint → stabil als 16-stellige HEX speichern (wie in mDNS)
      return nodeId.toString(16).padStart(16, "0").toUpperCase();
    }
    if (typeof nodeId === "string" || typeof nodeId === "number") {
      return nodeId;
    }
    return null;
  }

  private async toMatterDevice(device: MatterDeviceDiscovered) {
    const id = device.id;
    const nodeId = device.nodeId ?? "0";
    const vendorId = typeof device.vendorId === "number" ? device.vendorId : undefined;
    const productId = typeof device.productId === "number" ? device.productId : undefined;
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
      return new MatterSwitchDimmer(derivedName, id, nodeId, buttons);
    }
    if (typeFromVendor === DeviceType.SWITCH) {
      //get Buttons for Node
      const buttons = await this.deviceController.getButtonsForDevice(device);
      return new MatterSwitch(derivedName, id, nodeId, buttons);
    }
    if (typeFromVendor === DeviceType.SWITCH_ENERGY) {
      //get Buttons for Node
      const buttons = await this.deviceController.getButtonsForDevice(device);
      return new MatterSwitchEnergy(derivedName, id, nodeId, buttons);
    }

    // Fallback: wenn Vendor/Product unbekannt oder kein Mapping existiert, generisches Device speichern
    return new Device({
      id,
      name: derivedName,
      moduleId: MATTERCONFIG.id,
      isConnected: true
    });
  }

  convertDeviceFromDatabase(device: Device): Device | null {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }

    const deviceType = device.type as DeviceType;
    let convertedDevice: Device | null = null;

    switch (deviceType) {
      case DeviceType.SWITCH_ENERGY:
        const matterSwitchEnergy = new MatterSwitchEnergy();
        Object.assign(matterSwitchEnergy, device);
        convertedDevice = matterSwitchEnergy;
        break;
      case DeviceType.SWITCH:
        const matterSwitch = new MatterSwitch();
        Object.assign(matterSwitch, device);
        convertedDevice = matterSwitch;
        break;
      case DeviceType.SWITCH_DIMMER:
        const matterSwitchDimmer = new MatterSwitchDimmer();
        Object.assign(matterSwitchDimmer, device);
        convertedDevice = matterSwitchDimmer;
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
    }
  }
}

function toDeviceType(deviceTypeKey: string | null): DeviceType | null {
  if (!deviceTypeKey) return null;
  // `matterVendors.ts` nutzt aktuell i18n Keys wie "device.switch"
  if (deviceTypeKey === "device.switch") return DeviceType.SWITCH;
  if (deviceTypeKey === "device.switch-dimmer") return DeviceType.SWITCH_DIMMER;
  if (deviceTypeKey === "device.switch-energy") return DeviceType.SWITCH_ENERGY;
  return null;
}

