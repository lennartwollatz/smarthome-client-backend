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

type PairingPayload = {
  pairingCode?: string;
  manualCode?: string;
  qrCode?: string;
  code?: string;
  nodeId?: number | string;
  discriminator?: number | string;
  passcode?: number | string;
  timeoutSeconds?: number | string;
};

export class MatterModuleManager extends ModuleManager<MatterEventStreamManager, MatterDeviceController, MatterDeviceController, MatterEvent, Device, MatterDeviceDiscover, MatterDeviceDiscovered> {

  constructor(
    databaseManager: DatabaseManager,
    actionManager: ActionManager,
    eventStreamManager: EventStreamManager
  ) {
    const controller = new MatterDeviceController();
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
  async discoverDevices(): Promise<Device[]> {
    logger.info("Suche nach Matter-Geraeten im Netzwerk");
    try {
      const discoveredDevices = await this.deviceDiscover.discover(5);
      logger.info({ count: discoveredDevices.length }, "Geraete gefunden");
      this.initialiseEventStreamManager();
      // Matter-Geräte werden erst nach dem Pairing zu Devices konvertiert
      // Hier geben wir nur die discovered devices zurück
      return [];
    } catch (err) {
      logger.error({ err }, "Fehler bei der Geraeteerkennung");
      return [];
    }
  }

  async pairDevice(deviceId: string, payload: PairingPayload = {}): Promise<boolean> {
    logger.info({ deviceId }, "Starte Matter Pairing");
    const discoveredDevices = await this.deviceDiscover.discover(5);
    const device = discoveredDevices.find(d => d.id === deviceId);
    if (!device) {
      logger.warn({ deviceId }, "Matter-Geraet nicht gefunden");
      return false;
    }
    if (!device.address) {
      logger.warn({ deviceId }, "Matter-Geraet hat keine IPv4-Adresse");
      return false;
    }
    const port = typeof device.port === "number" && device.port > 0 ? device.port : 5540;

    const pairingCode = this.resolvePairingCode(payload);
    if (!pairingCode) {
      logger.warn({ deviceId }, "Pairing-Code fehlt");
      return false;
    }

    const nodeIdHint = payload.nodeId != null ? String(payload.nodeId) : "0";
    const resultNode = await this.deviceController.pairDevice(device.address, port, nodeIdHint, pairingCode);
    const nodeId = this.extractNodeId(resultNode) ?? this.extractNodeId(device) ?? nodeIdHint;
    const matterDevice = this.toMatterDevice(device, nodeId ?? device.id);
    const saved = this.actionManager.saveDevice(matterDevice);
    if (saved) {
      this.initialiseEventStreamManager();
    }
    return saved;
  }

  protected createEventStreamManager(): MatterEventStreamManager {
    return new MatterEventStreamManager(this.getManagerId(), this.deviceController, this.actionManager);
  }

  async readAttribute(deviceId: string, endpointId: number, clusterId: number, attributeId: number) {
    const nodeId = this.resolveNodeId(deviceId);
    if (!nodeId) return null;
    return this.deviceController.readAttribute(nodeId, endpointId, clusterId, attributeId);
  }

  async writeAttribute(
    deviceId: string,
    endpointId: number,
    clusterId: number,
    attributeId: number,
    value: unknown
  ) {
    const nodeId = this.resolveNodeId(deviceId);
    if (!nodeId) return false;
    await this.deviceController.writeAttribute(nodeId, endpointId, clusterId, attributeId, value);
    return true;
  }

  async invokeCommand(
    deviceId: string,
    endpointId: number,
    clusterId: number,
    commandId: number,
    payload?: Record<string, unknown>
  ) {
    const nodeId = this.resolveNodeId(deviceId);
    if (!nodeId) return null;
    return this.deviceController.invokeCommand(nodeId, endpointId, clusterId, commandId, payload);
  }


  private resolvePairingCode(payload: PairingPayload) {
    return (
      payload.pairingCode ??
      payload.manualCode ??
      payload.qrCode ??
      payload.code ??
      null
    );
  }

  private resolvePairingOptions(payload: PairingPayload) {
    const nodeId = toNumber(payload.nodeId);
    const discriminator = toNumber(payload.discriminator);
    const passcode = toNumber(payload.passcode);
    const timeoutSeconds = toNumber(payload.timeoutSeconds);
    return {
      nodeId: nodeId ?? undefined,
      discriminator: discriminator ?? undefined,
      passcode: passcode ?? undefined,
      timeoutSeconds: timeoutSeconds ?? undefined
    };
  }

  private extractNodeId(value: unknown): string | number | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const nodeId = record.nodeId ?? record.nodeID ?? record.id;
    if (typeof nodeId === "string" || typeof nodeId === "number") {
      return nodeId;
    }
    return null;
  }

  private resolveNodeId(deviceId: string) {
    if (!deviceId) return null;
    if (deviceId.startsWith("matter-")) {
      return deviceId.slice("matter-".length);
    }
    return deviceId;
  }

  private toMatterDevice(device: MatterDeviceDiscovered, nodeId: string | number) {
    const id = typeof nodeId === "string" || typeof nodeId === "number" ? `matter-${nodeId}` : device.id;
    return new Device({
      id,
      name: device.name,
      moduleId: "matter",
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
    }
  }
}

function toNumber(value: number | string | undefined) {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

