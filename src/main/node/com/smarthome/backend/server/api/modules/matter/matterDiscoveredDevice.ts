export class MatterDiscoveredDevice {
  id: string;
  name: string;
  address?: string;
  port?: number;
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

  constructor(
    id: string,
    name: string,
    address: string | undefined,
    port: number | undefined,
    vendorId: number | undefined,
    productId: number | undefined,
    discriminator: number | undefined,
    deviceType: number | undefined,
    instanceName: string | undefined,
    pairingHint: string | undefined,
    pairingInstruction: string | undefined,
    rotatingId: string | undefined,
    isCommissionable: boolean,
    isOperational: boolean,
    lastSeenAt = Date.now()
  ) {
    this.id = id;
    this.name = name;
    this.address = address;
    this.port = port;
    this.vendorId = vendorId;
    this.productId = productId;
    this.discriminator = discriminator;
    this.deviceType = deviceType;
    this.instanceName = instanceName;
    this.pairingHint = pairingHint;
    this.pairingInstruction = pairingInstruction;
    this.rotatingId = rotatingId;
    this.isCommissionable = isCommissionable;
    this.isOperational = isOperational;
    this.lastSeenAt = lastSeenAt;
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

