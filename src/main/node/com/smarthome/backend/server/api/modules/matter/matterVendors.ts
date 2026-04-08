import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";

/** CoolKit `extra.brandId` — Product-Keys sind dort eWeLink-`uiid`-Werte (z. B. 138). */
const SONOFF_EWE_LINK_CLOUD_VENDOR_ID = "5c4c1aee3a7d24c7100be054";
const SONOFF_MATTER_VENDOR_ID = "4897";
const EVE_MATTER_VENDOR_ID = "4874";

type ProductInfo = {
  productName: string;
  deviceType: string;
};

type VendorInfo = {
  vendorId: string;
  vendorName: string;
  products: Map<string, ProductInfo>; // Product ID -> ProductInfo
};

export class MatterVendors {
  private vendors = new Map<string, VendorInfo>();

  constructor() {
    this.initializeDefaultVendors();
  }

  /**
   * Gibt sowohl Vendor- als auch Product-Name zurück
   * @param vendorId Die Vendor ID
   * @param productId Die Product ID
   * @returns Ein Objekt mit vendorName, productName und deviceType, oder null wenn nicht gefunden
   */
  getVendorAndProductName(vendorId: string, productId: string): {
    vendorName: string;
    productName: string;
    deviceType: string;
  } | null {
    const vendor = this.vendors.get(vendorId);
    if (!vendor) return null;

    const product = vendor.products.get(productId);
    if (!product) return null;
    return {
      vendorName: vendor.vendorName,
      productName: product.productName,
      deviceType: product.deviceType
    };
  }

  /**
   * Entspricht den in dieser Klasse verwendeten Product-Keys (z. B. device.switch).
   */
  deviceTypeKeyToDeviceType(deviceTypeKey: string | null): DeviceType | null {
    if (!deviceTypeKey) return null;
    if (deviceTypeKey === "device.switch") return DeviceType.SWITCH;
    if (deviceTypeKey === "device.switch-dimmer") return DeviceType.SWITCH_DIMMER;
    if (deviceTypeKey === "device.switch-energy") return DeviceType.SWITCH_ENERGY;
    if (deviceTypeKey === "device.thermostat") return DeviceType.THERMOSTAT;
    return null;
  }

  /**
   * Initialisiert die Standard-Vendor- und Product-Liste
   */
  private initializeDefaultVendors(): void {
    this.addVendor(SONOFF_MATTER_VENDOR_ID, "SONOFF");
    this.addProduct(SONOFF_MATTER_VENDOR_ID, "2", "MINIR4M", "device.switch");
    this.addProduct(SONOFF_MATTER_VENDOR_ID, "292", "MINIDIM", "device.switch-dimmer");
    this.addVendor(EVE_MATTER_VENDOR_ID, "EVE");
    this.addProduct(EVE_MATTER_VENDOR_ID, "79", "Eve Thermo", "device.thermostat");
    this.addVendor(SONOFF_EWE_LINK_CLOUD_VENDOR_ID, "SONOFF");
    this.addProduct(SONOFF_EWE_LINK_CLOUD_VENDOR_ID, "138", "MINIR4M", "device.switch");
    this.addProduct(SONOFF_EWE_LINK_CLOUD_VENDOR_ID, "277", "MINIDIM", "device.switch-dimmer");
    this.addProduct(SONOFF_EWE_LINK_CLOUD_VENDOR_ID, "126", "DUALR3", "device.switch-energy");
  }

  /**
   * Gerätetyp aus Vendor- + Product-ID (Matter-Zahl, CoolKit-Brand-Hex, Matter-`vp`, …).
   */
  resolveDeviceType(
    vendorId: string | null,
    productId: string | null
  ): DeviceType | null {
    if (vendorId == null || vendorId === "" || productId == null || productId === "") return null;
    const info = this.getVendorAndProductName(vendorId, productId);
    return this.deviceTypeKeyToDeviceType(info?.deviceType ?? null);
  }


  private addVendor(vendorId: string, vendorName: string): void {
    const key = String(vendorId);
    if (!this.vendors.has(key)) {
      this.vendors.set(key, {
        vendorId: key,
        vendorName,
        products: new Map()
      });
    } else {
      const vendor = this.vendors.get(key)!;
      vendor.vendorName = vendorName;
    }
  }

  private addProduct(
    vendorId: string,
    productId: string,
    productName: string,
    deviceType: string
  ): void {
    const vKey = String(vendorId);
    const pKey = String(productId);
    if (!this.vendors.has(vKey)) {
      this.addVendor(vKey, `Vendor ${vKey}`);
    }
    const vendor = this.vendors.get(vKey)!;
    vendor.products.set(pKey, { productName, deviceType });
  }
}

// Singleton-Instanz für einfachen Zugriff
export const matterVendors = new MatterVendors();

