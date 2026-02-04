import { EventEmitter } from "node:events";
import { logger } from "../../../../logger.js";
import { NodeNetwork } from "./matterNodeNetwork.js";

type MatterModule = Record<string, any>;
type MatterNodeId = string | number;

export class MatterController {
  private controller: unknown | null = null;
  private initializing?: Promise<unknown>;
  private eventEmitter = new EventEmitter();
  private eventSubscriptionStop?: Function;
  private eventStreamRunning = false;
  private commissioningController: unknown | null = null;
  private commissioningControllerStarted = false;

  constructor(private controllerOverride?: unknown) {
    if (controllerOverride) {
      this.controller = controllerOverride;
    }
  }

  async ensureController() {
    if (this.controller) return this.controller;
    if (this.initializing) return this.initializing;
    this.initializing = this.createController();
    const created = await this.initializing;
    this.controller = created;
    this.initializing = undefined;
    return created;
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
    const calls: Array<{ name: string; args: unknown[] }> = [
      { name: "invokeCommand", args: [nodeId, endpointId, clusterId, commandId, payload] },
      { name: "invokeCommand", args: [{ nodeId, endpointId, clusterId, commandId, payload }] }
    ];
    return this.callFirst(controller, calls, "invokeCommand");
  }

  async startEventStream() {
    if (this.eventStreamRunning) return;
    const controller = await this.ensureController();
    const handler = (event: unknown) => this.eventEmitter.emit("event", event);
    this.eventSubscriptionStop = this.subscribeToEvents(controller, handler);
    this.eventStreamRunning = true;
  }

  stopEventStream() {
    if (!this.eventStreamRunning) return;
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

  onEvent(listener: (event: unknown) => void) {
    this.eventEmitter.on("event", listener);
  }

  offEvent(listener: (event: unknown) => void) {
    this.eventEmitter.off("event", listener);
  }

  async shutdown() {
    this.stopEventStream();
    const controller = this.controller;
    if (controller && typeof (controller as any).close === "function") {
      await (controller as any).close();
    } else if (controller && typeof (controller as any).shutdown === "function") {
      await (controller as any).shutdown();
    }
    this.controller = null;
  }

  private async createController() {
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
        logger.warn({ err }, "Matter Controller konnte nicht erstellt werden");
      }
    }
    throw new Error("Kein kompatibler Matter Controller in @project-chip/matter.js gefunden");
  }

  private async ensureCommissioningController() {
    if (this.commissioningController) return this.commissioningController;
    const controller = await this.createCommissioningController();
    this.commissioningController = controller;
    return controller;
  }

  private async createCommissioningController() {
    const matter = await loadMatterModule();
    const { Environment, Network, StorageBackendMemory, StorageService } = await import("@matter/general");
    const environment = Environment.default;
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
    return null;
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

