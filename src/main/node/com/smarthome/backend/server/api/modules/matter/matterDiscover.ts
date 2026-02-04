import os from "node:os";
import mdns from "multicast-dns";
import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import { MatterDiscoveredDevice } from "./matterDiscoveredDevice.js";

type MdnsInstance = ReturnType<typeof mdns>;

type ServiceCache = {
  name: string;
  host?: string;
  port?: number;
  txt?: Record<string, string>;
  ipv4?: string;
  ipv6?: string;
};

export class MatterDiscover {
  private static SERVICE_TYPE = "_matter._tcp.local";
  private repository: JsonRepository<MatterDiscoveredDevice>;
  private mdnsInstances: MdnsInstance[] = [];
  private mdnsTimers: Array<NodeJS.Timeout> = [];
  private serviceCache = new Map<string, ServiceCache>();
  private devicesMap = new Map<string, MatterDiscoveredDevice>();
  private ipv4Addresses = new Set<string>();

  constructor(databaseManager: DatabaseManager) {
    this.repository = new JsonRepository<MatterDiscoveredDevice>(databaseManager, "MatterDiscoveredDevice");
  }

  async discover(timeoutSeconds: number) {
    logger.info({ serviceType: MatterDiscover.SERVICE_TYPE }, "Starte mDNS-Discovery fuer Matter");
    this.devicesMap.clear();
    this.serviceCache.clear();
    this.ipv4Addresses.clear();
    this.startMdnsDiscovery();

    await new Promise(resolve => setTimeout(resolve, Math.max(timeoutSeconds, 1) * 1000));

    this.stopMdnsDiscovery();
    const devices = Array.from(this.devicesMap.values());
    devices.forEach(device => {
      this.repository.save(device.id, device);
      console.log("Matter Discovered Device: "+JSON.stringify(device));
    });
    return devices;
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
              questions: [{ name: MatterDiscover.SERVICE_TYPE, type: "PTR" }]
            });
          };
          query();
          const timer = setInterval(query, 2000);
          this.mdnsTimers.push(timer);
          logger.info(
            { iface: addr.address, serviceType: MatterDiscover.SERVICE_TYPE },
            "mDNS Discovery gestartet"
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
        entry.txt = this.parseTxt(record.data);
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

  private parseTxt(data: any[]): Record<string, string> {
    const txt: Record<string, string> = {};
    (data ?? []).forEach(entry => {
      const text = Buffer.isBuffer(entry) ? entry.toString("utf8") : String(entry);
      const [key, value] = text.split("=", 2);
      if (key) txt[key] = value ?? "";
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
      return;
    }
    const host = service.host ?? ipv4;
    const instanceName = getTxtValue(txt, ["DN", "dn", "name"]) ?? serviceName ?? ipv4;
    const [vendorId, productId] = parseVendorProduct(getTxtValue(txt, ["VP", "vp"]) ?? "");
    const discriminator = parseNumber(getTxtValue(txt, ["D", "d", "discriminator"]));
    const deviceType = parseNumber(getTxtValue(txt, ["DT", "dt", "deviceType"]));
    const pairingHint = getTxtValue(txt, ["PH", "ph", "pairingHint"]);
    const pairingInstruction = getTxtValue(txt, ["PI", "pi", "pairingInstruction"]);
    const rotatingId = getTxtValue(txt, ["RI", "ri", "rotatingId"]);
    const commissionMode = parseNumber(getTxtValue(txt, ["CM", "cm", "commissioningMode"]));
    const isCommissionable = typeof commissionMode === "number" ? commissionMode > 0 : false;
    const isOperational = true;
    const address = ipv4;
    const id = buildDeviceId(
      getTxtValue(txt, ["id", "ID", "nodeId", "nodeID"]),
      instanceName,
      address,
      discriminator
    );

    if (this.devicesMap.has(id)) return;

    const device = new MatterDiscoveredDevice(
      id,
      instanceName || "Matter Device",
      address || undefined,
      service.port,
      vendorId ?? undefined,
      productId ?? undefined,
      discriminator ?? undefined,
      deviceType ?? undefined,
      instanceName ?? undefined,
      pairingHint ?? undefined,
      pairingInstruction ?? undefined,
      rotatingId ?? undefined,
      isCommissionable,
      isOperational,
      Date.now()
    );

    this.devicesMap.set(id, device);
    this.ipv4Addresses.add(ipv4);
    logger.info({ deviceId: id, address }, "Matter-Geraet gefunden");
  }
}

function buildDeviceId(
  nodeId: string | undefined | null,
  instanceName: string | undefined | null,
  address: string | undefined | null,
  discriminator: number | null | undefined
) {
  if (nodeId) return `matter-${nodeId}`;
  if (instanceName) return `matter-${instanceName}`;
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

