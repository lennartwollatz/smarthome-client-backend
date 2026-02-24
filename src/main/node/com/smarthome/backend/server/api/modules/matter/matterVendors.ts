type ProductInfo = {
  productName: string;
  deviceType: string;
};

type VendorInfo = {
  vendorId: number;
  vendorName: string;
  products: Map<number, ProductInfo>; // Product ID -> ProductInfo
};

export class MatterVendors {
  private vendors = new Map<number, VendorInfo>();

  constructor() {
    this.initializeDefaultVendors();
  }

  /**
   * Gibt sowohl Vendor- als auch Product-Name zurück
   * @param vendorId Die Vendor ID
   * @param productId Die Product ID
   * @returns Ein Objekt mit vendorName, productName und deviceType, oder null wenn nicht gefunden
   */
  getVendorAndProductName(vendorId: number, productId: number): {
    vendorName: string;
    productName: string | null;
    deviceType: string | null;
  } | null {
    const vendor = this.vendors.get(vendorId);
    if (!vendor) return null;

    const product = vendor.products.get(productId);
    return {
      vendorName: vendor.vendorName,
      productName: product?.productName ?? null,
      deviceType: product?.deviceType ?? null
    };
  }

  /**
   * Initialisiert die Standard-Vendor- und Product-Liste
   */
  private initializeDefaultVendors(): void {
    // Vendor 4897 (aus deinem Beispiel)
    this.addVendor(4897, "SONOFF");
    this.addProduct(4897, 2, "MINIR4M", "device.switch");
    this.addProduct(4897, 292, "MINIDIM", "device.switch-dimmer");
  }

  private addVendor(vendorId: number, vendorName: string): void {
    if (!this.vendors.has(vendorId)) {
      this.vendors.set(vendorId, {
        vendorId,
        vendorName,
        products: new Map()
      });
    } else {
      const vendor = this.vendors.get(vendorId)!;
      vendor.vendorName = vendorName;
    }
  }

  private addProduct(vendorId: number, productId: number, productName: string, deviceType: string): void {
    if (!this.vendors.has(vendorId)) {
      this.addVendor(vendorId, `Vendor ${vendorId}`);
    }
    const vendor = this.vendors.get(vendorId)!;
    vendor.products.set(productId, { productName, deviceType });
  }
}

// Singleton-Instanz für einfachen Zugriff
export const matterVendors = new MatterVendors();

