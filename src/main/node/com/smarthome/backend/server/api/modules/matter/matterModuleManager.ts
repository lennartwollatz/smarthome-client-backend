import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import type { EventStreamManager } from "../../../events/eventStreamManager.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import { Device } from "../../../../model/index.js";
import { MatterDiscover } from "./matterDiscover.js";
import { MatterDiscoveredDevice } from "./matterDiscoveredDevice.js";
import { MatterController } from "./matterController.js";
import { MatterEventStreamManager } from "./matterEventStreamManager.js";

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

export class MatterModuleManager {
  private discoveredDeviceRepository: JsonRepository<MatterDiscoveredDevice>;
  private discover: MatterDiscover;
  private controller: MatterController;
  private actionManager: ActionManager;
  private eventStreamManager: EventStreamManager;
  private eventStreamRegistered = false;

  constructor(
    databaseManager: DatabaseManager,
    eventStreamManager: EventStreamManager,
    actionManager: ActionManager
  ) {
    this.discoveredDeviceRepository = new JsonRepository<MatterDiscoveredDevice>(
      databaseManager,
      "MatterDiscoveredDevice"
    );
    this.discover = new MatterDiscover(databaseManager);
    this.controller = new MatterController();
    this.actionManager = actionManager;
    this.eventStreamManager = eventStreamManager;
  }

  async discoverDevices(timeoutSeconds = 5) {
    logger.info("Suche nach Matter-Geraeten im Netzwerk");
    return this.discover.discover(timeoutSeconds);
  }

  async pairDevice(deviceId: string, payload: PairingPayload = {}) {
    logger.info({ deviceId }, "Starte Matter Pairing");
    const device = this.discoveredDeviceRepository.findById(deviceId);
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
    const resultNode = await this.controller.pairDevice(device.address, port, nodeIdHint, pairingCode);
    const nodeId = this.extractNodeId(resultNode) ?? this.extractNodeId(device) ?? nodeIdHint;
    const matterDevice = this.toMatterDevice(device, nodeId ?? device.id);
    const saved = this.actionManager.saveDevice(matterDevice);
    if (saved) {
      this.registerEventStreamManagerOnce();
    }
    return saved;
  }

  async readAttribute(deviceId: string, endpointId: number, clusterId: number, attributeId: number) {
    const nodeId = this.resolveNodeId(deviceId);
    if (!nodeId) return null;
    return this.controller.readAttribute(nodeId, endpointId, clusterId, attributeId);
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
    await this.controller.writeAttribute(nodeId, endpointId, clusterId, attributeId, value);
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
    return this.controller.invokeCommand(nodeId, endpointId, clusterId, commandId, payload);
  }

  private registerEventStreamManagerOnce() {
    if (this.eventStreamRegistered) return;
    try {
      const manager = new MatterEventStreamManager("default", this.controller, this.actionManager);
      this.eventStreamManager.registerModuleEventStreamManager(manager);
      this.eventStreamRegistered = true;
    } catch (err) {
      logger.warn({ err }, "Matter EventStreamManager konnte nicht registriert werden");
    }
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

  private toMatterDevice(device: MatterDiscoveredDevice, nodeId: string | number) {
    const id = typeof nodeId === "string" || typeof nodeId === "number" ? `matter-${nodeId}` : device.id;
    return new Device({
      id,
      name: device.name,
      moduleId: "matter",
      isConnected: true
    });
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

