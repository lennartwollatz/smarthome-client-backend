import { EventEmitter } from "node:events";
import { logger } from "../../../../logger.js";
import { NodeNetwork } from "./matterNodeNetwork.js";
import { MatterEvent } from "./matterEvent.js";
import { Device } from "../../../../model/devices/Device.js";
import { ModuleDeviceControllerEvent } from "../moduleDeviceControllerEvent.js";

type MatterModule = Record<string, any>;
type MatterNodeId = string | number;

export class MatterDeviceController extends ModuleDeviceControllerEvent<MatterEvent, Device> {
  private initializing?: Promise<unknown>;
  private controller?: unknown;
  private eventEmitter = new EventEmitter();
  private eventSubscriptionStop?: Function;
  private eventStreamRunning = false;
  private commissioningController: unknown | null = null;
  private commissioningControllerStarted = false;

  constructor() {
    super();
  }

  async ensureController() {
    if (this.initializing) return this.initializing;
    this.initializing = this.createController();
    try {
      const created = await this.initializing;
      this.controller = created;
      this.initializing = undefined;
      return created;
    } catch (err) {
      this.initializing = undefined;
      logger.error({ err }, "Matter Controller konnte nicht erstellt werden");
      return null;
    }
  }

  async pairDevice(ip: string, port: number, deviceId: string, pairingCode: string) {
    const controller = await this.ensureCommissioningController();
    if (!controller) {
      logger.warn("Matter CommissioningController ist nicht verfuegbar");
      return null;
    }
    if (!this.commissioningControllerStarted && typeof (controller as any).start === "function") {
      await (controller as any).start();
      this.commissioningControllerStarted = true;
    }

    const { ManualPairingCodeCodec, NodeId } = await import("@matter/types");
    const { GeneralCommissioning } = await import("@matter/types/clusters");

    const pairingData = ManualPairingCodeCodec.decode(pairingCode);
    const shortDiscriminator = pairingData.shortDiscriminator;
    const setupPin = pairingData.passcode;

    const nodeId = toNodeId(NodeId, deviceId);
    const commissionedNodes = typeof (controller as any).getCommissionedNodes === "function"
      ? (controller as any).getCommissionedNodes()
      : [];

    let targetNodeId = nodeId;
    if (!commissionedNodes.includes(nodeId)) {
      const commissioningOptions = {
        regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
        regulatoryCountryCode: "DE"
      };
      const options = {
        commissioning: commissioningOptions,
        discovery: {
          knownAddress: { ip, port, type: "udp" },
          identifierData: { shortDiscriminator },
          discoveryCapabilities: { ble: false }
        },
        passcode: setupPin
      };
      targetNodeId = await (controller as any).commissionNode(options);
    }

    if (typeof (controller as any).getNode === "function") {
      return (controller as any).getNode(targetNodeId);
    }
    if (typeof (controller as any).connectNode === "function") {
      return (controller as any).connectNode(targetNodeId);
    }
    return null;
  }

  async getNode(nodeId: MatterNodeId) {
    const controller = await this.ensureController();
    if (!controller) {
      logger.warn({ nodeId }, "Matter Controller nicht verfügbar für getNode");
      return null;
    }
    const calls: Array<{ name: string; args: unknown[] }> = [
      { name: "getNode", args: [nodeId] },
      { name: "getDevice", args: [nodeId] },
      { name: "connectToNode", args: [nodeId] },
      { name: "connectDevice", args: [nodeId] }
    ];
    return this.callFirst(controller, calls, "getNode");
  }

  async readAttribute(
    nodeId: MatterNodeId,
    endpointId: number,
    clusterId: number,
    attributeId: number
  ) {
    const node = await this.getNode(nodeId);
    if (node && typeof (node as any).readAttribute === "function") {
      return (node as any).readAttribute({ endpointId, clusterId, attributeId });
    }
    const controller = await this.ensureController();
    if (!controller) {
      logger.warn({ nodeId }, "Matter Controller nicht verfügbar für readAttribute");
      return null;
    }
    const calls: Array<{ name: string; args: unknown[] }> = [
      { name: "readAttribute", args: [nodeId, endpointId, clusterId, attributeId] },
      { name: "readAttribute", args: [{ nodeId, endpointId, clusterId, attributeId }] }
    ];
    return this.callFirst(controller, calls, "readAttribute");
  }

  async writeAttribute(
    nodeId: MatterNodeId,
    endpointId: number,
    clusterId: number,
    attributeId: number,
    value: unknown
  ) {
    const node = await this.getNode(nodeId);
    if (node && typeof (node as any).writeAttribute === "function") {
      return (node as any).writeAttribute({ endpointId, clusterId, attributeId, value });
    }
    const controller = await this.ensureController();
    if (!controller) {
      logger.warn({ nodeId }, "Matter Controller nicht verfügbar für writeAttribute");
      return false;
    }
    const calls: Array<{ name: string; args: unknown[] }> = [
      { name: "writeAttribute", args: [nodeId, endpointId, clusterId, attributeId, value] },
      { name: "writeAttribute", args: [{ nodeId, endpointId, clusterId, attributeId, value }] }
    ];
    return this.callFirst(controller, calls, "writeAttribute");
  }

  async invokeCommand(
    nodeId: MatterNodeId,
    endpointId: number,
    clusterId: number,
    commandId: number,
    payload?: Record<string, unknown>
  ) {
    const node = await this.getNode(nodeId);
    if (node && typeof (node as any).invokeCommand === "function") {
      return (node as any).invokeCommand({ endpointId, clusterId, commandId, payload });
    }
    const controller = await this.ensureController();
    if (!controller) {
      logger.warn({ nodeId }, "Matter Controller nicht verfügbar für invokeCommand");
      return null;
    }
    const calls: Array<{ name: string; args: unknown[] }> = [
      { name: "invokeCommand", args: [nodeId, endpointId, clusterId, commandId, payload] },
      { name: "invokeCommand", args: [{ nodeId, endpointId, clusterId, commandId, payload }] }
    ];
    return this.callFirst(controller, calls, "invokeCommand");
  }

  private deviceCallbacks = new Map<string, (event: MatterEvent) => void>();

  public async startEventStream(device: Device, callback: (event: MatterEvent) => void): Promise<void> {
    const deviceId = device.id ?? "";
    if (!deviceId) {
      logger.warn("Device ID ist erforderlich für EventStreamListener");
      return;
    }

    // Speichere den Callback für dieses Gerät
    this.deviceCallbacks.set(deviceId, callback);

    if (this.eventStreamRunning) {
      // Event-Stream läuft bereits global, füge nur den Callback hinzu
      return;
    }
    
    try {
      const controller = await this.ensureController();
      if (!controller) {
        logger.warn({ deviceId }, "Matter Controller nicht verfügbar, EventStream kann nicht gestartet werden");
        return;
      }
      const handler = (event: unknown) => {
        // Rufe alle registrierten Callbacks auf
        this.deviceCallbacks.forEach((cb, id) => {
          const mappedEvent = this.mapEvent(event, id);
          if (mappedEvent) {
            cb(mappedEvent);
          }
        });
        this.eventEmitter.emit("event", event);
      };
      this.eventSubscriptionStop = this.subscribeToEvents(controller, handler);
      this.eventStreamRunning = true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Starten des Matter EventStreams");
      // Entferne den Callback wieder, da der Stream nicht gestartet werden konnte
      this.deviceCallbacks.delete(deviceId);
    }
  }

  public async stopEventStream(device: Device): Promise<void> {
    const deviceId = device.id ?? "";
    if (!deviceId) {
      return;
    }

    // Entferne den Callback für dieses Gerät
    this.deviceCallbacks.delete(deviceId);

    // Wenn keine Callbacks mehr registriert sind, stoppe den Event-Stream
    if (this.deviceCallbacks.size === 0 && this.eventStreamRunning) {
      if (this.eventSubscriptionStop) {
        try {
          this.eventSubscriptionStop();
        } catch (err) {
          logger.warn({ err }, "Matter EventStream konnte nicht sauber beendet werden");
        }
        this.eventSubscriptionStop = undefined;
      }
      this.eventStreamRunning = false;
    }
  }

  private mapEvent(event: unknown, deviceId?: string): MatterEvent | null {
    if (!event) return null;
    if (typeof event !== "object") {
      return { name: String(event), deviceId };
    }
    const record = event as Record<string, unknown>;
    const payload = record.payload && typeof record.payload === "object" ? (record.payload as Record<string, unknown>) : {};
    return {
      nodeId: record.nodeId as string | number | undefined,
      deviceId: (record.deviceId as string | undefined) ?? deviceId,
      event: record.event as string | undefined,
      name: record.name as string | undefined,
      online: record.online as boolean | undefined,
      isOnline: record.isOnline as boolean | undefined,
      reachable: record.reachable as boolean | undefined,
      payload
    };
  }

  async shutdown() {
    const controller = this.controller;
    if (controller && typeof (controller as any).close === "function") {
      await (controller as any).close();
    } else if (controller && typeof (controller as any).shutdown === "function") {
      await (controller as any).shutdown();
    }
    this.controller = null;
  }

  private async createController() {
    try {
      const matter = await loadMatterModule();
      const candidates = [
        matter.CommissioningController,
        matter.Controller,
        matter.MatterController,
        matter.NodeController
      ].filter(Boolean);
      for (const candidate of candidates) {
        try {
          if (typeof candidate?.create === "function") {
            return await candidate.create();
          }
          if (typeof candidate === "function") {
            return new candidate();
          }
        } catch (err) {
          logger.warn({ err }, "Matter Controller Kandidat konnte nicht erstellt werden");
        }
      }
      logger.error("Kein kompatibler Matter Controller in @project-chip/matter.js gefunden");
      return null;
    } catch (err) {
      logger.error({ err }, "Fehler beim Laden oder Erstellen des Matter Controllers");
      return null;
    }
  }

  private async ensureCommissioningController() {
    if (this.commissioningController) return this.commissioningController;
    const controller = await this.createCommissioningController();
    this.commissioningController = controller;
    return controller;
  }

  private async createCommissioningController() {
    try {
      const matter = await loadMatterModule();
      const { Environment, Network, StorageBackendMemory, StorageService } = await import("@matter/general");
      
      if (!Environment || !Environment.default) {
        logger.error("Matter Environment ist nicht verfügbar");
        return null;
      }
      
      const environment = Environment.default;
      if (!environment) {
        logger.error("Matter Environment.default ist undefined");
        return null;
      }
      
      const storageService =
        environment.maybeGet(StorageService) ?? new StorageService(environment);
      storageService.factory = async () => StorageBackendMemory.create();
      storageService.location = "memory";
      if (!environment.has(Network)) {
        environment.set(Network, new NodeNetwork());
      }
      if (matter.CommissioningController) {
        return new matter.CommissioningController({
          environment: { environment, id: "smarthome-backend-controller" },
          adminFabricLabel: "smarthome-backend",
          autoConnect: true
        });
      }
      logger.warn("Matter CommissioningController ist nicht verfügbar");
      return null;
    } catch (err) {
      logger.error({ err }, "Fehler beim Erstellen des Matter CommissioningControllers");
      return null;
    }
  }

  private subscribeToEvents(controller: unknown, handler: (event: unknown) => void) {
    const ctrl = controller as Record<string, any>;
    if (typeof ctrl.subscribeAllEvents === "function") {
      const result = ctrl.subscribeAllEvents(handler);
      return this.normalizeSubscription(ctrl, "subscribeAllEvents", result, handler);
    }
    if (typeof ctrl.subscribeEvents === "function") {
      const result = ctrl.subscribeEvents(handler);
      return this.normalizeSubscription(ctrl, "subscribeEvents", result, handler);
    }
    if (typeof ctrl.on === "function") {
      ctrl.on("event", handler);
      return () => this.detachEventListener(ctrl, "event", handler);
    }
    logger.warn("Matter Controller unterstützt keine Event-Subscription");
    return () => undefined;
  }

  private normalizeSubscription(
    controller: Record<string, any>,
    event: string,
    result: unknown,
    handler: (event: unknown) => void
  ) {
    if (typeof result === "function") {
      return result;
    }
    if (result && typeof (result as any).unsubscribe === "function") {
      return () => (result as any).unsubscribe();
    }
    return () => this.detachEventListener(controller, event, handler);
  }

  private detachEventListener(controller: Record<string, any>, event: string, handler: (...args: any[]) => void) {
    if (typeof controller.off === "function") {
      controller.off(event, handler);
      return;
    }
    if (typeof controller.removeListener === "function") {
      controller.removeListener(event, handler);
    }
  }

  private async callFirst(
    target: unknown,
    calls: Array<{ name: string; args: unknown[] }>,
    label: string
  ) {
    const record = target as Record<string, any>;
    for (const call of calls) {
      const fn = record?.[call.name];
      if (typeof fn !== "function") continue;
      try {
        return await fn.apply(target, call.args);
      } catch (err) {
        logger.debug({ err, method: call.name }, "Matter Controller Methode fehlgeschlagen");
      }
    }
    logger.warn({ label }, "Matter Controller Methode nicht verfügbar");
    return null;
  }
}

async function loadMatterModule(): Promise<MatterModule> {
  const matter = (await import("@project-chip/matter.js")) as unknown;
  return matter as MatterModule;
}

function toNodeId(NodeId: (id: bigint) => unknown, deviceId: string) {
  if (!deviceId) return NodeId(BigInt(0));
  try {
    const asBigInt = BigInt(deviceId);
    return NodeId(asBigInt);
  } catch {
    return NodeId(BigInt(0));
  }
}

