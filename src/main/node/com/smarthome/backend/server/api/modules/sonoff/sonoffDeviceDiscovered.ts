import { ModuleDeviceDiscovered } from "../moduleDeviceDiscovered.js";

export type SonoffDeviceDiscoveredInit = {
  id: string;
  name: string;
  address: string;
  port?: number;
  /** eWeLink-Geräte-ID (z. B. aus der App / Zeroconf), falls bekannt */
  ewelinkDeviceId?: string;
  /** Matter-Vendor-ID (z. B. aus VP), nicht CoolKit `extra.brandId` */
  vendorId?: string;
  /** CoolKit `extra.uiid` in der Discovery-API; Matter-`productId` nur falls keine uiid */
  productId?: string;
  /** CoolKit `brandName` */
  brandName?: string;
  /** CoolKit `productModel` (z. B. MINIR4M) */
  productModel?: string;
  /** CoolKit `extra.modelInfo` */
  ewelinkModelInfo?: string;
  /** CoolKit `extra.mac` */
  ewelinkMac?: string;
  isPaired?: boolean;
  /** LAN-API-Schlüssel nach erfolgreichem Pairing */
  apiKey?: string;
  pairedAt?: number;
  txtRecord?: Record<string, string>;
  /** Aus Cloud `params.configure` (`outlet`-Werte); ohne configure: `[-1]` (ein Kanal, kein Outlet-Feld am LAN-Request). */
  outletIds?: number[];
};

export class SonoffDeviceDiscovered implements ModuleDeviceDiscovered {
  id: string;
  name: string;
  address: string;
  port: number;
  ewelinkDeviceId?: string;
  vendorId?: string;
  productId?: string;
  brandName?: string;
  productModel?: string;
  ewelinkModelInfo?: string;
  ewelinkMac?: string;
  isPaired: boolean;
  apiKey?: string;
  pairedAt?: number;
  txtRecord?: Record<string, string>;
  outletIds?: number[];

  constructor(init: SonoffDeviceDiscoveredInit) {
    this.id = init.id;
    this.name = init.name;
    this.address = init.address ?? "";
    this.port = init.port ?? 8081;
    this.ewelinkDeviceId = init.ewelinkDeviceId;
    this.vendorId = init.vendorId;
    this.productId = init.productId;
    this.brandName = init.brandName;
    this.productModel = init.productModel;
    this.ewelinkModelInfo = init.ewelinkModelInfo;
    this.ewelinkMac = init.ewelinkMac;
    this.isPaired = init.isPaired ?? false;
    this.apiKey = init.apiKey;
    this.pairedAt = init.pairedAt;
    this.txtRecord = init.txtRecord;
    this.outletIds = init.outletIds;
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
}
