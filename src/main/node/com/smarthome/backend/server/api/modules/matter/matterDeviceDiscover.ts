import os from "node:os";
import mdns from "multicast-dns";
import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { MatterDeviceDiscovered } from "./matterDeviceDiscovered.js";
import { ModuleDeviceDiscover } from "../moduleDeviceDiscover.js";
import { MATTERCONFIG, MATTERMODULE } from "./matterModule.js";
import { matterVendors } from "./matterVendors.js";

type MdnsInstance = ReturnType<typeof mdns>;

type ServiceCache = {
  name: string;
  host?: string;
  port?: number;
  txt?: Record<string, string>;
  ipv4?: string;
  ipv6?: string;
};

export class MatterDeviceDiscover extends ModuleDeviceDiscover<MatterDeviceDiscovered> {
  /** Operational Discovery (bereits gepaarte Geraete) */
  public static SERVICE_TYPE_OPERATIONAL = "_matter._tcp.local";
  /** Commissionable Discovery (noch nicht gepaarte Geraete) */
  public static SERVICE_TYPE_COMMISSIONABLE = "_matterc._udp.local";

  private mdnsInstances: MdnsInstance[] = [];
  private mdnsTimers: Array<NodeJS.Timeout> = [];
  private serviceCache = new Map<string, ServiceCache>();
  private devicesMap = new Map<string, MatterDeviceDiscovered>();
  private ipv4Addresses = new Set<string>();

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  getModuleName(): string {
    return MATTERMODULE.name;
  }

  getDiscoveredDeviceTypeName(): string {
    return MATTERCONFIG.deviceTypeName;
  }

  public async startDiscovery(timeoutSeconds: number): Promise<MatterDeviceDiscovered[]> {
    this.devicesMap.clear();
    this.serviceCache.clear();
    this.ipv4Addresses.clear();
    this.startMdnsDiscovery();

    await new Promise(resolve => setTimeout(resolve, Math.max(timeoutSeconds, 1) * 1000));

    this.stopMdnsDiscovery();
    return Array.from(this.devicesMap.values());
  }

  public async stopDiscovery(): Promise<void> {
    this.stopMdnsDiscovery();
  }

  private startMdnsDiscovery() {
    this.stopMdnsDiscovery();
    const interfaces = os.networkInterfaces();
    Object.values(interfaces).forEach(iface => {
      (iface ?? []).forEach(addr => {
        if (addr.internal) return;
        if (addr.family !== "IPv4") return;
        try {
          const instance = mdns({ interface: addr.address });
          this.mdnsInstances.push(instance);
          instance.on("response", (response: any) => this.handleMdnsResponse(response));
          const query = () => {
            instance.query({
              questions: [
                { name: MatterDeviceDiscover.SERVICE_TYPE_OPERATIONAL, type: "PTR" },
                { name: MatterDeviceDiscover.SERVICE_TYPE_COMMISSIONABLE, type: "PTR" }
              ]
            });
          };
          query();
          const timer = setInterval(query, 2000);
          this.mdnsTimers.push(timer);
          logger.info(
            { iface: addr.address },
            "mDNS Discovery gestartet (operational + commissionable)"
          );
        } catch (err) {
          logger.warn({ err, iface: addr.address }, "Konnte mDNS nicht starten");
        }
      });
    });

    if (this.mdnsInstances.length === 0) {
      logger.warn("Keine mDNS-Instanz fuer Discovery erzeugt");
    }
  }

  private stopMdnsDiscovery() {
    this.mdnsTimers.forEach(timer => clearInterval(timer));
    this.mdnsTimers = [];
    this.mdnsInstances.forEach(instance => {
      try {
        instance.removeAllListeners();
        instance.destroy();
      } catch (err) {
        logger.warn({ err }, "Fehler beim Schliessen von mDNS");
      }
    });
    this.mdnsInstances = [];
  }

  private handleMdnsResponse(response: { answers?: any[]; additionals?: any[] }) {
    const records = [...(response.answers ?? []), ...(response.additionals ?? [])];
    for (const record of records) {
      if (record.type === "PTR" && typeof record.data === "string") {
        this.ensureService(record.data);
      }
      if (record.type === "SRV") {
        const entry = this.ensureService(record.name as string);
        entry.host = record.data?.target;
        entry.port = record.data?.port;
      }
      if (record.type === "TXT") {
        const entry = this.ensureService(record.name as string);
        const parsed = this.parseTxt(record.data);
        // Merge statt ueberschreiben, damit Daten aus mehreren Responses erhalten bleiben
        entry.txt = { ...(entry.txt ?? {}), ...parsed };
      }
      if (record.type === "A") {
        const entry = this.findServiceByHost(record.name);
        if (entry) entry.ipv4 = record.data;
      }
      if (record.type === "AAAA") {
        const entry = this.findServiceByHost(record.name);
        if (entry) entry.ipv6 = record.data;
      }
    }

    for (const [name, service] of this.serviceCache.entries()) {
      if (!service.txt) continue;
      this.tryCreateDevice(name, service);
    }
  }

  private ensureService(name: string) {
    if (!this.serviceCache.has(name)) {
      this.serviceCache.set(name, { name });
    }
    return this.serviceCache.get(name)!;
  }

  private findServiceByHost(host: string) {
    for (const service of this.serviceCache.values()) {
      if (service.host === host) return service;
    }
    return undefined;
  }

  /**
   * Parst TXT-Record-Daten in key=value Paare.
   * Unterstuetzt echte Buffer-Objekte, JSON-serialisierte Buffer ({type:"Buffer",data:[...]})
   * und plain Strings.
   */
  private parseTxt(data: any[]): Record<string, string> {
    const txt: Record<string, string> = {};
    (data ?? []).forEach(entry => {
      let text: string;
      if (Buffer.isBuffer(entry)) {
        text = entry.toString("utf8");
      } else if (
        entry && typeof entry === "object" &&
        entry.type === "Buffer" && Array.isArray(entry.data)
      ) {
        // JSON-serialisierter Buffer: {type: "Buffer", data: [byte, byte, ...]}
        text = Buffer.from(entry.data).toString("utf8");
      } else {
        text = String(entry ?? "");
      }
      const eqIdx = text.indexOf("=");
      if (eqIdx > 0) {
        const key = text.substring(0, eqIdx);
        const value = text.substring(eqIdx + 1);
        if (key) txt[key] = value;
      } else if (text.trim()) {
        // Schluessel ohne Wert (Flag)
        txt[text.trim()] = "";
      }
    });
    return txt;
  }

  private tryCreateDevice(serviceName: string, service: ServiceCache) {
    const txt = service.txt ?? {};
    const ipv4 = service.ipv4 ?? null;
    if (!ipv4) {
      return;
    }
    if (this.ipv4Addresses.has(ipv4)) {
      // Wenn das Geraet schon existiert, aktualisiere es mit neuen TXT-Daten
      this.tryMergeDevice(ipv4, serviceName, txt);
      return;
    }
    const instanceName = getTxtValue(txt, ["DN", "dn", "name"]) ?? serviceName ?? ipv4;
    const displayName = sanitizeDiscoveredName(instanceName);

    // Commissioning-Felder (aus _matterc._udp)
    const [vendorId, productId] = parseVendorProduct(getTxtValue(txt, ["VP", "vp"]) ?? "");
    const discriminator = parseNumber(getTxtValue(txt, ["D", "d", "discriminator"]));
    const deviceType = parseNumber(getTxtValue(txt, ["DT", "dt", "deviceType"]));
    const pairingHint = getTxtValue(txt, ["PH", "ph", "pairingHint"]);
    const pairingInstruction = getTxtValue(txt, ["PI", "pi", "pairingInstruction"]);
    const rotatingId = getTxtValue(txt, ["RI", "ri", "rotatingId"]);
    const commissionMode = parseNumber(getTxtValue(txt, ["CM", "cm", "commissioningMode"]));
    const isCommissionable = typeof commissionMode === "number" ? commissionMode > 0 : false;

    // Name bevorzugt aus Vendor/Product ableiten (falls bekannt), sonst displayName/Fallback
    const vendorProduct = (vendorId != null && productId != null)
      ? matterVendors.getVendorAndProductName(vendorId, productId)
      : null;
    const nameFromVendor = vendorProduct?.productName
      ? `${vendorProduct.vendorName} ${vendorProduct.productName}`.trim()
      : null;
    const preferredName = nameFromVendor ?? (displayName || "Matter Device");

    // Operational TXT-Felder (aus _matter._tcp – MRP Parameter)
    const sessionIdleInterval = parseNumber(getTxtValue(txt, ["SII", "sii"]));
    const sessionActiveInterval = parseNumber(getTxtValue(txt, ["SAI", "sai"]));
    const sessionActiveThreshold = parseNumber(getTxtValue(txt, ["SAT", "sat"]));
    const tcpRaw = getTxtValue(txt, ["T", "t"]);
    const tcpSupported = tcpRaw != null ? tcpRaw !== "0" : undefined;

    // Servicename-Format fuer operational: "{compressedFabricId}-{nodeId}._matter._tcp.local"
    const { compressedFabricId, operationalNodeId } = parseOperationalServiceName(serviceName);
    const isOperational = Boolean(compressedFabricId && operationalNodeId);

    const address = ipv4;
    const id = buildDeviceId(
      operationalNodeId ?? getTxtValue(txt, ["id", "ID", "nodeId", "nodeID"]),
      // Wichtig: Service-Type-Suffixe aus der ID entfernen
      displayName,
      address,
      discriminator
    );

    if (this.devicesMap.has(id)) return;

    const device = new MatterDeviceDiscovered({
      id,
      // Primär aus vendorId/productId über matterVendors, sonst displayName/Fallback
      name: preferredName,
      address: address || "",
      port: service.port ?? 5540,
      vendorId: vendorId ?? undefined,
      productId: productId ?? undefined,
      discriminator: discriminator ?? undefined,
      deviceType: deviceType ?? undefined,
      instanceName: instanceName ?? undefined,
      pairingHint: pairingHint ?? undefined,
      pairingInstruction: pairingInstruction ?? undefined,
      rotatingId: rotatingId ?? undefined,
      isCommissionable,
      isOperational,
      sessionIdleInterval: sessionIdleInterval ?? undefined,
      sessionActiveInterval: sessionActiveInterval ?? undefined,
      sessionActiveThreshold: sessionActiveThreshold ?? undefined,
      tcpSupported,
      compressedFabricId: compressedFabricId ?? undefined,
      operationalNodeId: operationalNodeId ?? undefined,
      txtRecord: Object.keys(txt).length > 0 ? { ...txt } : undefined,
      isPaired: false
    });

    this.devicesMap.set(id, device);
    this.ipv4Addresses.add(ipv4);
    logger.info(
      {
        deviceId: id,
        address,
        deviceType: deviceType ?? undefined,
        vendorId: vendorId ?? undefined,
        productId: productId ?? undefined,
        isCommissionable,
        isOperational,
        txtKeys: Object.keys(txt)
      },
      "Matter-Geraet gefunden"
    );
  }

  private tryMergeDevice(ipv4: string, serviceName: string, txt: Record<string, string>) {
    const existing = Array.from(this.devicesMap.values()).find(d => d.address === ipv4);
    if (!existing) return;

    // Commissioning-Felder nachtraeglich ergaenzen (falls noch leer)
    const [vendorId, productId] = parseVendorProduct(getTxtValue(txt, ["VP", "vp"]) ?? "");
    if (vendorId != null && existing.vendorId == null) existing.vendorId = vendorId;
    if (productId != null && existing.productId == null) existing.productId = productId;

    const discriminator = parseNumber(getTxtValue(txt, ["D", "d", "discriminator"]));
    if (discriminator != null && existing.discriminator == null) existing.discriminator = discriminator;

    const deviceType = parseNumber(getTxtValue(txt, ["DT", "dt", "deviceType"]));
    if (deviceType != null && existing.deviceType == null) existing.deviceType = deviceType;

    const pairingHint = getTxtValue(txt, ["PH", "ph", "pairingHint"]);
    if (pairingHint && !existing.pairingHint) existing.pairingHint = pairingHint;

    const pairingInstruction = getTxtValue(txt, ["PI", "pi", "pairingInstruction"]);
    if (pairingInstruction && !existing.pairingInstruction) existing.pairingInstruction = pairingInstruction;

    const rotatingId = getTxtValue(txt, ["RI", "ri", "rotatingId"]);
    if (rotatingId && !existing.rotatingId) existing.rotatingId = rotatingId;

    const dn = getTxtValue(txt, ["DN", "dn", "name"]);
    if (dn && (!existing.instanceName || existing.instanceName === existing.address)) {
      existing.instanceName = dn;
      existing.name = dn;
    }

    // Operational-Felder nachtraeglich ergaenzen
    const sii = parseNumber(getTxtValue(txt, ["SII", "sii"]));
    if (sii != null && existing.sessionIdleInterval == null) existing.sessionIdleInterval = sii;
    const sai = parseNumber(getTxtValue(txt, ["SAI", "sai"]));
    if (sai != null && existing.sessionActiveInterval == null) existing.sessionActiveInterval = sai;
    const sat = parseNumber(getTxtValue(txt, ["SAT", "sat"]));
    if (sat != null && existing.sessionActiveThreshold == null) existing.sessionActiveThreshold = sat;

    const tcpRaw = getTxtValue(txt, ["T", "t"]);
    if (tcpRaw != null && existing.tcpSupported == null) existing.tcpSupported = tcpRaw !== "0";

    const { compressedFabricId, operationalNodeId } = parseOperationalServiceName(serviceName);
    if (compressedFabricId && !existing.compressedFabricId) existing.compressedFabricId = compressedFabricId;
    if (operationalNodeId && !existing.operationalNodeId) existing.operationalNodeId = operationalNodeId;

    if (compressedFabricId && operationalNodeId) existing.isOperational = true;

    const commissionMode = parseNumber(getTxtValue(txt, ["CM", "cm", "commissioningMode"]));
    if (typeof commissionMode === "number" && commissionMode > 0) existing.isCommissionable = true;

    // TXT-Record mergen
    if (Object.keys(txt).length > 0) {
      existing.txtRecord = { ...(existing.txtRecord ?? {}), ...txt };
    }
  }
}

/**
 * Extrahiert compressedFabricId und nodeId aus dem operativen Servicenamen.
 * Format: "{compressedFabricId}-{nodeId}._matter._tcp.local"
 * Beispiel: "E88D9A700E9C3DE2-0000000033F78B0E._matter._tcp.local"
 */
function parseOperationalServiceName(serviceName: string): { compressedFabricId?: string; operationalNodeId?: string } {
  if (!serviceName) return {};
  // Entferne den Service-Suffix
  const prefixes = ["."+ MatterDeviceDiscover.SERVICE_TYPE_OPERATIONAL, "."+ MatterDeviceDiscover.SERVICE_TYPE_COMMISSIONABLE];
  let instancePart = serviceName;
  for (const suffix of prefixes) {
    if (serviceName.endsWith(suffix)) {
      instancePart = serviceName.slice(0, -suffix.length);
      break;
    }
  }
  // Operational-Format: {fabricId}-{nodeId} (beide Hex)
  const match = instancePart.match(/^([0-9A-Fa-f]{16})-([0-9A-Fa-f]{16})$/);
  if (match) {
    return {
      compressedFabricId: match[1],
      operationalNodeId: match[2]
    };
  }
  return {};
}

function buildDeviceId(
  nodeId: string | undefined | null,
  instanceName: string | undefined | null,
  address: string | undefined | null,
  discriminator: number | null | undefined
) {
  if (nodeId) return `matter-${nodeId}`;
  if (instanceName) return `matter-${sanitizeDiscoveredName(instanceName)}`;
  if (address) return `matter-${address}`;
  if (discriminator != null) return `matter-${discriminator}`;
  return `matter-${Math.random().toString(16).slice(2)}`;
}

function getTxtValue(txt: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = txt[key];
    if (typeof value === "string" && value.trim().length) return value;
  }
  return null;
}

function parseVendorProduct(value: string) {
  if (!value) return [null, null] as const;
  const [vendor, product] = value.split("+");
  return [parseNumber(vendor), parseNumber(product)] as const;
}

function parseNumber(value?: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function sanitizeDiscoveredName(input: string) {
  let s = String(input ?? "").trim();
  if (!s) return "";

  // Entferne Service-Type-Suffixe (werden im serviceName oft angehängt)
  const types = [
    MatterDeviceDiscover.SERVICE_TYPE_OPERATIONAL,
    MatterDeviceDiscover.SERVICE_TYPE_COMMISSIONABLE
  ];
  for (const t of types) {
    // Varianten mit/ohne führenden Punkt entfernen
    s = s.replaceAll(`.${t}`, "");
    s = s.replaceAll(t, "");
  }

  // Überflüssige Punkte am Anfang/Ende bereinigen
  s = s.replace(/^\.+/, "").replace(/\.+$/, "").trim();
  return s;
}
