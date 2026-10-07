import { ModuleDeviceDiscovered } from "../moduleDeviceDiscovered.js";

export type MatterDeviceDiscoveredInit = {
  id: string;
  name: string;
  address: string;
  port?: number;
  vendorId?: number;
  productId?: number;
  discriminator?: number;
  deviceType?: number;
  instanceName?: string;
  pairingHint?: string;
  pairingInstruction?: string;
  rotatingId?: string;
  isCommissionable?: boolean;
  isOperational?: boolean;
  lastSeenAt?: number;

  // Operational TXT-Felder (MRP Parameter)
  sessionIdleInterval?: number;
  sessionActiveInterval?: number;
  sessionActiveThreshold?: number;
  tcpSupported?: boolean;

  // Aus dem mDNS-Servicenamen extrahierte IDs
  compressedFabricId?: string;
  operationalNodeId?: string;

  // Persistente Pairing/Verbindungsdaten (werden nach erfolgreichem Pairing gesetzt)
  nodeId?: string;
  nodeFabricId?: string;
  token?: string;
  pairedAt?: number;
  isPaired?: boolean;

  // Alle TXT-Eintraege als Map (fuer zukuenftige/unbekannte Felder)
  txtRecord?: Record<string, string>;
};

export class MatterDeviceDiscovered implements ModuleDeviceDiscovered {
  id: string;
  name: string;
  address: string;
  port: number;
  vendorId?: number;
  productId?: number;
  discriminator?: number;
  deviceType?: number;
  instanceName?: string;
  pairingHint?: string;
  pairingInstruction?: string;
  rotatingId?: string;
  isCommissionable: boolean;
  isOperational: boolean;
  lastSeenAt: number;

  // Operational TXT-Felder (MRP Parameter)
  sessionIdleInterval?: number;
  sessionActiveInterval?: number;
  sessionActiveThreshold?: number;
  tcpSupported?: boolean;

  // Aus dem mDNS-Servicenamen extrahierte IDs
  compressedFabricId?: string;
  operationalNodeId?: string;

  // Persistente Pairing/Verbindungsdaten
  nodeId?: string;
  nodeFabricId?: string;
  token?: string;
  pairedAt?: number;
  isPaired?: boolean;

  // Alle TXT-Eintraege als Map
  txtRecord?: Record<string, string>;

  constructor(init: MatterDeviceDiscoveredInit) {
    this.id = init.id;
    this.name = init.name;
    this.address = init.address ?? "";
    this.port = init.port ?? 5540;
    this.vendorId = init.vendorId;
    this.productId = init.productId;
    this.discriminator = init.discriminator;
    this.deviceType = init.deviceType;
    this.instanceName = init.instanceName;
    this.pairingHint = init.pairingHint;
    this.pairingInstruction = init.pairingInstruction;
    this.rotatingId = init.rotatingId;
    this.isCommissionable = init.isCommissionable ?? false;
    this.isOperational = init.isOperational ?? false;
    this.lastSeenAt = init.lastSeenAt ?? Date.now();

    this.sessionIdleInterval = init.sessionIdleInterval;
    this.sessionActiveInterval = init.sessionActiveInterval;
    this.sessionActiveThreshold = init.sessionActiveThreshold;
    this.tcpSupported = init.tcpSupported;

    this.compressedFabricId = init.compressedFabricId;
    this.operationalNodeId = init.operationalNodeId;

    this.nodeId = init.nodeId;
    this.nodeFabricId = init.nodeFabricId;
    this.token = init.token;
    this.pairedAt = init.pairedAt;

    this.txtRecord = init.txtRecord;
  }

  getId() {
    return this.id;
  }

  getName() {
    return this.name;
  }

  getAddress() {
    return this.address;
  }

  getPort() {
    return this.port;
  }

  getVendorId() {
    return this.vendorId;
  }

  getProductId() {
    return this.productId;
  }

  getDiscriminator() {
    return this.discriminator;
  }

  getDeviceType() {
    return this.deviceType;
  }

  getInstanceName() {
    return this.instanceName;
  }

  getPairingHint() {
    return this.pairingHint;
  }

  getPairingInstruction() {
    return this.pairingInstruction;
  }

  getRotatingId() {
    return this.rotatingId;
  }

  getIsCommissionable() {
    return this.isCommissionable;
  }

  getIsOperational() {
    return this.isOperational;
  }

  getLastSeenAt() {
    return this.lastSeenAt;
  }
}
