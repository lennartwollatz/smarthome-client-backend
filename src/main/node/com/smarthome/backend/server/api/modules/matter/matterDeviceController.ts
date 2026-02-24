import { EventEmitter } from "node:events";
import { logger } from "../../../../logger.js";
import { NodeNetwork } from "./matterNodeNetwork.js";
import { MatterEvent } from "./matterEvent.js";
import { Device } from "../../../../model/devices/Device.js";
import { ModuleDeviceControllerEvent } from "../moduleDeviceControllerEvent.js";
import { MatterDevice } from "./devices/matterDevice.js";

import { CommissioningController, NodeCommissioningOptions } from "@project-chip/matter.js";
import type { PairedNode } from "@project-chip/matter.js/device";
import { GeneralCommissioning, OnOff } from "@matter/types/clusters";
import { ManualPairingCodeCodec, ManualPairingData, NodeId } from "@matter/types";
import { Environment, Network, StorageService } from "@matter/general";
import { MatterDeviceDiscovered } from "./matterDeviceDiscovered.js";
import { PairingPayload } from "./matterModuleManager.js";
import { DatabaseManager } from "../../../db/database.js";
import { MatterDatabaseStorage } from "./matterDatabaseStorage.js";


export class MatterDeviceController extends ModuleDeviceControllerEvent<MatterEvent, Device> {
  private eventEmitter = new EventEmitter();
  private eventSubscriptionStop?: Function;
  private eventStreamRunning = false;
  private commissioningController: CommissioningController | null = null;
  private commissioningControllerStarted = false;
  private databaseManager: DatabaseManager;
  constructor(databaseManager: DatabaseManager) {
    super();
    this.databaseManager = databaseManager;
    this.ensureCommissioningController().then(controller => {
        this.commissioningControllerStarted = true;
    });
  }

  async pairDevice(device: MatterDeviceDiscovered, payload: PairingPayload): Promise<MatterDeviceDiscovered | null> {
    //ip: string, port: number, deviceId: string, pairingCode: string
    const controller = await this.ensureCommissioningController();
    if (!controller) {
      logger.warn("Matter CommissioningController ist nicht verfuegbar");
      return null;
    }

    // Controller starten falls noch nicht geschehen (analog ControllerNode.js)
    if (!this.commissioningControllerStarted) {
      await controller.start();
      this.commissioningControllerStarted = true;
      logger.info("Matter CommissioningController gestartet");
    }

    const port = typeof device.port === "number" && device.port > 0 ? device.port : 5540;

    const pairingData = this.resolvePairingCode(payload);
    if (!pairingData) {
      logger.warn({ deviceId: device.id }, "Pairing-Code fehlt");
      return null;
    }

    const shortDiscriminator = pairingData.shortDiscriminator;
    const setupPin = pairingData.passcode;

    const nodeId = NodeId(device.nodeId ?? 0);

    // Prüfe ob das Gerät bereits kommissioniert ist
    const commissionedNodes = controller.getCommissionedNodes();
    const commissionedNodesBefore = new Set(commissionedNodes.map(id => String(id)));
    let targetNodeId: NodeId = nodeId;

    if (!commissionedNodes.some(n => n === nodeId)) {
      // Neues Gerät kommissionieren (analog ControllerNode.js)
      console.log("Starte Matter Commissioning für", device.id);

      const options: NodeCommissioningOptions = {
        commissioning: {
          regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
          regulatoryCountryCode: "DE"
        },
        discovery: {
          identifierData: { shortDiscriminator },
          discoveryCapabilities: { ble:false },
          knownAddress: { type: "udp", ip: device.address, port: port }
        },
        passcode: setupPin
      };

      // Vollständiges Commissioning inkl. operativer Discovery/Connect.
      // Manche Geräte scheitern erst im finalen operativen Reconnect, obwohl AddNOC bereits erfolgreich war.
      // Dann übernehmen wir die frisch kommissionierte NodeId aus dem Controller, statt das Pairing komplett zu verwerfen.
      try {
        targetNodeId = await controller.commissionNode(options);
      } catch (err) {
        if (!this.isOperativeReconnectFailure(err)) {
          throw err;
        }
        const recoveredNodeId = this.findNewCommissionedNodeId(controller, commissionedNodesBefore);
        if (!recoveredNodeId) {
          throw err;
        }
        logger.warn(
          { err, deviceId: device.id, recoveredNodeId: String(recoveredNodeId) },
          "Commissioning-Reconnect fehlgeschlagen, übernehme dennoch kommissionierte NodeId"
        );
        targetNodeId = recoveredNodeId;
      }
      
    } else {
      console.log("Matter Gerät ist bereits kommissioniert, verbinde...", nodeId);
    }

    device.nodeId = String(targetNodeId);
    device.isPaired = true;
    device.pairedAt = Date.now();
    device.isOperational = true;
    device.isCommissionable = false;
    return device;

  }

  async unpairDevice(device: MatterDevice): Promise<boolean> {
    const nodeId = device.getNodeId();
    if (!nodeId) return false;
    const controller = await this.ensureCommissioningController();
    if (!controller) {
      logger.warn({ nodeId }, "Matter CommissioningController nicht verfügbar für unpairDevice");
      return false;
    }
    const node: PairedNode = await controller.getNode(nodeId);
    await node.decommission();
    return true;
  }

  /**
   * Commissioniert ein Matter-Gerät ausschließlich über den Pairing-Code (ohne bekannte IP/Port).
   * Nutzt Discovery (mDNS/BLE je nach Plattform) basierend auf shortDiscriminator + passcode.
   *
   * Beispiel:
   *   const result = await controller.pairDeviceByCode("1234-5678");
   */
  async pairDeviceByCode(pairingCode: string): Promise<{ nodeId: NodeId } | null> {
    const controller = await this.ensureCommissioningController();
    if (!controller) {
      logger.warn("Matter CommissioningController ist nicht verfuegbar");
      return null;
    }

    if (!this.commissioningControllerStarted) {
      await controller.start();
      this.commissioningControllerStarted = true;
      logger.info("Matter CommissioningController gestartet");
    }

    const pairingData = ManualPairingCodeCodec.decode(pairingCode);
    const shortDiscriminator = pairingData.shortDiscriminator;
    const setupPin = pairingData.passcode;

    if (shortDiscriminator == null) {
      logger.warn({ pairingData }, "Pairing-Code enthält keinen shortDiscriminator");
      return null;
    }

    const options: NodeCommissioningOptions = {
      commissioning: {
        regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
        regulatoryCountryCode: "DE"
      },
      discovery: {
        identifierData: { shortDiscriminator },
        // onIpNetwork ist i.d.R. der relevante Pfad; BLE kann auf manchen Plattformen zusätzlich helfen
        discoveryCapabilities: { onIpNetwork: true, ble: true }
      },
      passcode: setupPin
    };

    const commissionedNodesBefore = new Set(controller.getCommissionedNodes().map(id => String(id)));
    try {
      const nodeId = await controller.commissionNode(options);
      return { nodeId };
    } catch (err) {
      if (!this.isOperativeReconnectFailure(err)) {
        throw err;
      }
      const recoveredNodeId = this.findNewCommissionedNodeId(controller, commissionedNodesBefore);
      if (!recoveredNodeId) {
        throw err;
      }
      logger.warn(
        { err, recoveredNodeId: String(recoveredNodeId) },
        "Commissioning-Reconnect (Pairing by Code) fehlgeschlagen, übernehme dennoch kommissionierte NodeId"
      );
      return { nodeId: recoveredNodeId };
    }
  }

  async getButtonsForDevice(device: MatterDeviceDiscovered): Promise<string[]> {
    console.log("getButtonsForDevice", device);
    if( !device.nodeId) return [];
    const node = await this.getNode(NodeId(device.nodeId));
    if( !node) return [];
    const buttons = node.getDevices();
    if (buttons.length === 0) {
      logger.warn({ nodeId: device.nodeId }, "Keine Endpoints gefunden (leer nach Connect)");
    }
    console.log("buttons", buttons);
    return buttons.map(b => String(b.getNumber()));
  }

  /**
   * Liefert einen PairedNode aus dem CommissioningController.
   * Vorgehen analog zu `SonoffPlatform.ts`: NodeId parsen -> controller.getNode(nodeId) -> optional connect().
   */
  async getNode(nodeId: NodeId): Promise<PairedNode | null> {
    console.log("getNode", String(nodeId));
    const controller = await this.ensureCommissioningController();
    console.log("controller startet");
    if (!controller) {
      logger.warn({ nodeId }, "Matter CommissioningController nicht verfügbar für getNode");
      return null;
    }

    if (!this.commissioningControllerStarted) {
      await controller.start();
      this.commissioningControllerStarted = true;
      console.log("controller startet");
    }

    const nodes = controller.getCommissionedNodes();
    console.log("nodes", nodes);

    // Nur wenn bereits commissioned, sonst null zurück
    if (!controller.isNodeCommissioned(nodeId)) {
      console.log("Matter Node ist nicht commissioned", nodeId);
      return null;
    }

    const node = await controller.connectNode(nodeId);
    console.log("Node found", node);

    

    return node;
  }

  async toggleSwitch(device: MatterDevice, buttonId: string) {
    const node = await this.getNode(device.getNodeId());
    if( node !== null){
      const button  = node.getDeviceById(Number(buttonId) ?? 0);
      if(!button) return false;
      const onOff:any = button.getClusterClient(OnOff.Complete);
      if (onOff !== undefined) {
          if( device.getButton(buttonId)?.isOn() ?? false ){
            onOff.on();
          } else {
            onOff.off();
          }
          return status;
      }
    }
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
      const controller = await this.ensureCommissioningController();
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
    const controller = this.commissioningController;
    if (controller && controller.isCommissioned()){
      controller?.close();
    }
    
    this.commissioningController = null;
    this.commissioningControllerStarted = false;
  }

  private async ensureCommissioningController(): Promise<CommissioningController | null> {
    if (this.commissioningController) return this.commissioningController;
    const controller = await this.createCommissioningController();
    this.commissioningController = controller;
    return controller;
  }

  private async createCommissioningController(): Promise<CommissioningController | null> {
    try {

      if (!Environment || !Environment.default) {
        logger.error("Matter Environment ist nicht verfügbar");
        return null;
      }

      const environment = Environment.default;
      if (!environment) {
        logger.error("Matter Environment.default ist undefined");
        return null;
      }

      // Persistenter Matter-Storage über die vorhandene Datenbank
      const storageService =
        environment.maybeGet(StorageService) ?? new StorageService(environment);
      const storage = new MatterDatabaseStorage(this.databaseManager);
      storageService.factory = async () => storage;
      storageService.location = "sqlite:matter";

      // Netzwerk registrieren falls nicht vorhanden
      if (!environment.has(Network)) {
        environment.set(Network, new NodeNetwork());
      }

      // CommissioningController erstellen (analog ControllerNode.js)
      const controller = new CommissioningController({
        environment: { environment, id: "1668012345678" },
        adminFabricLabel: "smarthome-backend",
        autoConnect: true
      });

      await controller.start();

      logger.info("Matter CommissioningController erstellt");
      return controller;
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

  private resolvePairingCode(payload: PairingPayload): ManualPairingData {
    const code = payload.pairingCode ?? "";
    return ManualPairingCodeCodec.decode(code);
  }

  private async waitForNodeRemoteInitialization(node: PairedNode, timeoutMs: number): Promise<void> {
    if (node.remoteInitializationDone) {
      return;
    }

    const deadline = Date.now() + timeoutMs;
    while (!node.remoteInitializationDone && Date.now() < deadline) {
      await this.sleep(200);
    }

    if (!node.remoteInitializationDone) {
      throw new Error(`Matter Node Initialisierung Timeout nach ${timeoutMs}ms`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private findNewCommissionedNodeId(
    controller: CommissioningController,
    commissionedNodesBefore: Set<string>
  ): NodeId | null {
    const commissionedNodesAfter = controller.getCommissionedNodes();
    for (const candidate of commissionedNodesAfter) {
      if (!commissionedNodesBefore.has(String(candidate))) {
        return candidate;
      }
    }
    return null;
  }

  private isOperativeReconnectFailure(err: unknown): boolean {
    const message = this.stringifyError(err);
    return (
      message.includes("Operative reconnection with device failed") ||
      message.includes("No discovery was requested")
    );
  }

  private stringifyError(err: unknown): string {
    if (err instanceof Error) {
      const parts = [err.message, err.stack ?? ""];
      return parts.join("\n");
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
}


