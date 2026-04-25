import { ModuleDeviceDiscovered } from "../moduleDeviceDiscovered.js";

export type MatterDeviceDiscoveredInit = {
  id: string;
  name: string;
  address: string;
  port?: number;
  vendorId?: string;
  productId?: string;
  discriminator?: number;
  rotatingId?: string;
  isCommissionable?: boolean;
  isOperational?: boolean;
  nodeId?: string;
  pairedAt?: number;
  isPaired?: boolean;
};

export class MatterDeviceDiscovered implements ModuleDeviceDiscovered {
  id: string;
  name: string;
  address: string;
  port: number;
  vendorId?: string;
  productId?: string;
  discriminator?: number;
  rotatingId?: string;
  isCommissionable: boolean;
  isOperational: boolean;
  nodeId?: string;
  pairedAt?: number;
  isPaired?: boolean;

  constructor(init: MatterDeviceDiscoveredInit) {
    this.id = init.id;
    this.name = init.name;
    this.address = init.address ?? "";
    this.port = init.port ?? 5540;
    this.vendorId = init.vendorId;
    this.productId = init.productId;
    this.discriminator = init.discriminator;
    this.rotatingId = init.rotatingId;
    this.isCommissionable = init.isCommissionable ?? false;
    this.isOperational = init.isOperational ?? false;
    this.nodeId = init.nodeId;
    this.pairedAt = init.pairedAt;
    this.isPaired = init.isPaired;
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

  getRotatingId() {
    return this.rotatingId;
  }

  getIsCommissionable() {
    return this.isCommissionable;
  }

  getIsOperational() {
    return this.isOperational;
  }
}
