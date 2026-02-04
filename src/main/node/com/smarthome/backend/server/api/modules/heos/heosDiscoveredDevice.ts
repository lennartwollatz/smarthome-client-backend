export class HeosDiscoveredDevice {
  udn: string;
  friendlyName: string;
  modelName: string;
  modelNumber: string;
  deviceId: string;
  wlanMac: string;
  address: string;

  ipv4Address?: string;
  ipv6Address?: string;
  port?: number;
  mdnsName?: string;
  firmwareVersion?: string;
  serialNumber?: string;
  manufacturer?: string;

  ipAddress?: string;
  pid?: number;
  name?: string;

  constructor(
    udn: string,
    friendlyName: string,
    modelName: string,
    modelNumber: string,
    deviceId: string,
    wlanMac: string,
    address: string
  ) {
    this.udn = udn;
    this.friendlyName = friendlyName;
    this.modelName = modelName;
    this.modelNumber = modelNumber;
    this.deviceId = deviceId;
    this.wlanMac = wlanMac;
    this.address = address;
    this.ipAddress = undefined;
    this.pid = 0;
    this.name = undefined;
  }

  getUdn() {
    return this.udn;
  }

  getFriendlyName() {
    return this.friendlyName;
  }

  getModelName() {
    return this.modelName;
  }

  getModelNumber() {
    return this.modelNumber;
  }

  getDeviceId() {
    return this.deviceId;
  }

  getWlanMac() {
    return this.wlanMac;
  }

  getAddress() {
    return this.address;
  }

  getIpv4Address() {
    return this.ipv4Address;
  }

  getIpv6Address() {
    return this.ipv6Address;
  }

  getPort() {
    return this.port ?? 0;
  }

  getMdnsName() {
    return this.mdnsName;
  }

  getFirmwareVersion() {
    return this.firmwareVersion;
  }

  getSerialNumber() {
    return this.serialNumber;
  }

  getManufacturer() {
    return this.manufacturer;
  }

  getIpAddress() {
    return this.ipAddress;
  }

  getPid() {
    return this.pid ?? 0;
  }

  getName() {
    return this.name;
  }

  setAddress(address: string) {
    this.address = address;
  }

  setIpv4Address(ipv4Address: string) {
    this.ipv4Address = ipv4Address;
  }

  setIpv6Address(ipv6Address: string) {
    this.ipv6Address = ipv6Address;
  }

  setPort(port: number) {
    this.port = port;
  }

  setMdnsName(mdnsName: string) {
    this.mdnsName = mdnsName;
  }

  setFirmwareVersion(firmwareVersion: string) {
    this.firmwareVersion = firmwareVersion;
  }

  setSerialNumber(serialNumber: string) {
    this.serialNumber = serialNumber;
  }

  setManufacturer(manufacturer: string) {
    this.manufacturer = manufacturer;
  }

  setIpAddress(ipAddress: string) {
    this.ipAddress = ipAddress;
  }

  setPid(pid: number) {
    this.pid = pid;
  }

  setName(name: string) {
    this.name = name;
  }

  getBestConnectionAddress(): string | null {
    if (this.ipv4Address?.length) {
      return this.ipv4Address;
    }
    if (this.ipv6Address?.length) {
      return this.stripIpv6Brackets(this.ipv6Address);
    }
    if (this.ipAddress?.length) {
      return this.ipAddress;
    }
    if (this.address?.length) {
      return this.stripIpv6Brackets(this.address);
    }
    return null;
  }

  private stripIpv6Brackets(value: string) {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }
}

