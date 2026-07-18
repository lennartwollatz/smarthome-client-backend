import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { LGDeviceDiscovered } from "./lgDeviceDiscovered.js";
import { ModuleDeviceDiscover } from "../moduleDeviceDiscover.js";
import { LGCONFIG, LGMODULE } from "./lgModule.js";
import { createMdnsSocketsForDiscovery, type MdnsInstance } from "../multicastDnsFactory.js";

type ServiceCache = {
  name: string;
  host?: string;
  port?: number;
  txt?: Record<string, string>;
  ipv4?: string;
};

export type LGMdnsReachabilityTarget = {
  deviceId: string;
  address?: string | null;
  macAddress?: string | null;
};

type ReachabilityState = {
  normalizedIp: string;
  normalizedMac: string;
  lastSeenMs: number;
  wasSeen: boolean;
  offlineReported: boolean;
};

export class LGDeviceDiscover extends ModuleDeviceDiscover<LGDeviceDiscovered> {
  private static SERVICE_TYPE = "_airplay._tcp.local";
  private static REACHABILITY_QUERY_INTERVAL_MS = 5_000;
  private static REACHABILITY_CHECK_INTERVAL_MS = 5_000;
  private static REACHABILITY_TIMEOUT_MS = 15_000;

  private reachabilityStates = new Map<string, ReachabilityState>();
  private reachabilityCallback?: (deviceId: string) => void;
  private reachabilityMdnsInstances: MdnsInstance[] = [];
  private reachabilityQueryTimers: Array<NodeJS.Timeout> = [];
  private reachabilityCheckTimer?: NodeJS.Timeout;
  private reachabilityServiceCache = new Map<string, ServiceCache>();

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  getModuleName(): string {
    return LGMODULE.name;
  }

  getDiscoveredDeviceTypeName(): string {
    return LGCONFIG.deviceTypeName;
  }

  static normalizeConnectionIp(address: string | undefined | null): string {
    if (address == null || address === "") {
      return "";
    }
    return address.replace(/^\[|\]$/g, "").trim().toLowerCase();
  }

  static normalizeMacAddress(mac: string | null | undefined): string {
    if (mac == null || mac === "") {
      return "";
    }
    let s = mac.trim().replace(/-/g, ":").toUpperCase();
    if (!s.includes(":") && /^[0-9A-F]{12}$/i.test(s)) {
      s = s.match(/.{1,2}/g)!.join(":");
    }
    return s;
  }

  private matchesLGDevice(txt?: Record<string, string>) {
    if (!txt) return false;
    const manufacturer = txt.manufacturer ?? "";
    const integrator = txt.integrator ?? "";
    const isLG =
      (manufacturer && manufacturer.toLowerCase() === "lg") ||
      (integrator && integrator.toLowerCase() === "lg");
    if (!isLG) {
      logger.debug({ manufacturer, integrator }, "mDNS Geraet ist kein LG");
    }
    return isLG;
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

  private ensureService(serviceCache: Map<string, ServiceCache>, name: string): ServiceCache {
    if (!serviceCache.has(name)) {
      serviceCache.set(name, { name });
    }
    return serviceCache.get(name)!;
  }

  private findServiceByHost(serviceCache: Map<string, ServiceCache>, host: string): ServiceCache | undefined {
    for (const service of serviceCache.values()) {
      if (service.host === host) return service;
    }
    return undefined;
  }

  private extractMacAddressFromService(service: ServiceCache): string | null {
    const serialNumber = service.txt?.serialNumber ?? "";
    let macAddress: string | null = null;
    if (serialNumber) {
      const underscoreIndex = serialNumber.lastIndexOf("_");
      if (underscoreIndex >= 0 && underscoreIndex + 1 < serialNumber.length) {
        macAddress = serialNumber.substring(underscoreIndex + 1);
      } else {
        macAddress = serialNumber;
      }
    }
    if (!macAddress && service.txt) {
      const raw = service.txt.deviceid ?? service.txt.mac ?? service.txt.pi ?? "";
      const first = raw.split(/[|,]/)[0]?.trim() ?? "";
      if (first) {
        macAddress = first;
      }
    }
    return macAddress;
  }

  private buildDiscoveredDevice(name: string, service: ServiceCache): LGDeviceDiscovered | null {
    if (!service.txt || !service.ipv4) return null;
    if (!this.matchesLGDevice(service.txt)) return null;

    const host = service.ipv4;
    const manufacturer = service.txt.manufacturer ?? "";
    const integrator = service.txt.integrator ?? "";
    const serialNumber = service.txt.serialNumber ?? "";
    const deviceName = name || host;
    const deviceId = `lg-mdns-${host}-${serialNumber || "unknown"}`;
    const macAddress = this.extractMacAddressFromService(service);

    return new LGDeviceDiscovered(
      deviceId,
      deviceName,
      host,
      service.port ?? 8080,
      LGDeviceDiscover.SERVICE_TYPE,
      manufacturer,
      integrator,
      macAddress
    );
  }

  private ingestMdnsResponse(
    response: { answers?: any[]; additionals?: any[] },
    serviceCache: Map<string, ServiceCache>,
    onResolvedDevice?: (device: LGDeviceDiscovered) => void
  ): void {
    const records = [...(response.answers ?? []), ...(response.additionals ?? [])];
    for (const record of records) {
      if (record.type === "PTR" && typeof record.data === "string") {
        this.ensureService(serviceCache, record.data);
      }
      if (record.type === "SRV") {
        const entry = this.ensureService(serviceCache, record.name as string);
        entry.host = record.data?.target;
        entry.port = record.data?.port;
      }
      if (record.type === "TXT") {
        const entry = this.ensureService(serviceCache, record.name as string);
        entry.txt = this.parseTxt(record.data);
      }
      if (record.type === "A") {
        const ipv4 = typeof record.data === "string" ? record.data : undefined;
        if (ipv4 && record.ttl === 0) {
          this.handleReachabilityGoodbye(ipv4);
        }
        const entry = this.findServiceByHost(serviceCache, record.name);
        if (entry && ipv4) entry.ipv4 = ipv4;
      }
    }

    for (const [name, service] of serviceCache.entries()) {
      const device = this.buildDiscoveredDevice(name, service);
      if (!device) continue;
      onResolvedDevice?.(device);
    }
  }

  /**
   * Laufender mDNS-Listener fuer gepairte LG-TVs.
   * Meldet, wenn ein Fernseher nicht mehr per AirPlay/mDNS sichtbar ist.
   */
  public startReachabilityMonitoring(
    targets: LGMdnsReachabilityTarget[],
    onUnreachable: (deviceId: string) => void
  ): void {
    this.stopReachabilityMonitoring();
    this.reachabilityCallback = onUnreachable;
    this.reachabilityServiceCache.clear();
    this.reachabilityStates.clear();

    for (const target of targets) {
      if (!target.deviceId) continue;
      this.reachabilityStates.set(target.deviceId, {
        normalizedIp: LGDeviceDiscover.normalizeConnectionIp(target.address),
        normalizedMac: LGDeviceDiscover.normalizeMacAddress(target.macAddress),
        lastSeenMs: 0,
        wasSeen: false,
        offlineReported: false,
      });
    }

    if (this.reachabilityStates.size === 0) {
      logger.debug("LG mDNS-Erreichbarkeits-Listener: keine Ziele");
      return;
    }

    const handleResponse = (response: { answers?: any[]; additionals?: any[] }) => {
      this.ingestMdnsResponse(response, this.reachabilityServiceCache, device => {
        this.markReachabilitySeen(device.address, device.macAddress);
      });
    };

    for (const { instance, ifaceLabel } of createMdnsSocketsForDiscovery()) {
      this.reachabilityMdnsInstances.push(instance);
      instance.on("response", handleResponse);

      const query = () => {
        instance.query({
          questions: [{ name: LGDeviceDiscover.SERVICE_TYPE, type: "PTR" }],
        });
      };
      query();
      this.reachabilityQueryTimers.push(
        setInterval(query, LGDeviceDiscover.REACHABILITY_QUERY_INTERVAL_MS)
      );
      logger.info(
        { iface: ifaceLabel, serviceType: LGDeviceDiscover.SERVICE_TYPE },
        "LG mDNS-Erreichbarkeits-Listener gestartet"
      );
    }

    if (!this.reachabilityMdnsInstances.length) {
      logger.warn("LG mDNS-Erreichbarkeits-Listener: keine mDNS-Instanz erzeugt");
      return;
    }

    this.reachabilityCheckTimer = setInterval(
      () => this.checkReachabilityTimeouts(),
      LGDeviceDiscover.REACHABILITY_CHECK_INTERVAL_MS
    );
  }

  public stopReachabilityMonitoring(): void {
    this.reachabilityCallback = undefined;
    this.reachabilityStates.clear();
    this.reachabilityServiceCache.clear();

    if (this.reachabilityCheckTimer) {
      clearInterval(this.reachabilityCheckTimer);
      this.reachabilityCheckTimer = undefined;
    }

    this.reachabilityQueryTimers.forEach(timer => clearInterval(timer));
    this.reachabilityQueryTimers = [];

    this.reachabilityMdnsInstances.forEach(instance => {
      try {
        instance.removeAllListeners();
        instance.destroy();
      } catch (err) {
        logger.warn({ err }, "Fehler beim Schliessen des LG mDNS-Erreichbarkeits-Listeners");
      }
    });
    this.reachabilityMdnsInstances = [];
  }

  public updateReachabilityTargets(targets: LGMdnsReachabilityTarget[]): void {
    if (!this.reachabilityCallback) {
      return;
    }

    const callback = this.reachabilityCallback;
    const existingStates = new Map(this.reachabilityStates);
    this.reachabilityStates.clear();

    for (const target of targets) {
      if (!target.deviceId) continue;
      const previous = existingStates.get(target.deviceId);
      this.reachabilityStates.set(target.deviceId, {
        normalizedIp: LGDeviceDiscover.normalizeConnectionIp(target.address),
        normalizedMac: LGDeviceDiscover.normalizeMacAddress(target.macAddress),
        lastSeenMs: previous?.lastSeenMs ?? 0,
        wasSeen: previous?.wasSeen ?? false,
        offlineReported: previous?.offlineReported ?? false,
      });
    }

    if (this.reachabilityStates.size === 0) {
      this.stopReachabilityMonitoring();
      return;
    }

    this.reachabilityCallback = callback;
  }

  private markReachabilitySeen(address: string, macAddress: string | null): void {
    const normalizedIp = LGDeviceDiscover.normalizeConnectionIp(address);
    const normalizedMac = LGDeviceDiscover.normalizeMacAddress(macAddress);
    const now = Date.now();

    for (const [deviceId, state] of this.reachabilityStates.entries()) {
      const ipMatch = Boolean(state.normalizedIp && normalizedIp && state.normalizedIp === normalizedIp);
      const macMatch = Boolean(state.normalizedMac && normalizedMac && state.normalizedMac === normalizedMac);
      if (!ipMatch && !macMatch) continue;

      state.lastSeenMs = now;
      state.wasSeen = true;
      state.offlineReported = false;
      this.reachabilityStates.set(deviceId, state);
    }
  }

  private handleReachabilityGoodbye(ipv4: string): void {
    const normalizedIp = LGDeviceDiscover.normalizeConnectionIp(ipv4);
    if (!normalizedIp) return;

    for (const [deviceId, state] of this.reachabilityStates.entries()) {
      if (state.normalizedIp !== normalizedIp) continue;
      if (!state.wasSeen || state.offlineReported) continue;
      this.reportReachabilityLost(deviceId, state, "goodbye");
    }
  }

  private checkReachabilityTimeouts(): void {
    const now = Date.now();
    for (const [deviceId, state] of this.reachabilityStates.entries()) {
      if (!state.wasSeen || state.offlineReported) continue;
      if (now - state.lastSeenMs <= LGDeviceDiscover.REACHABILITY_TIMEOUT_MS) continue;
      this.reportReachabilityLost(deviceId, state, "timeout");
    }
  }

  private reportReachabilityLost(
    deviceId: string,
    state: ReachabilityState,
    reason: "goodbye" | "timeout"
  ): void {
    state.offlineReported = true;
    this.reachabilityStates.set(deviceId, state);
    logger.error(
      { deviceId, reason, address: state.normalizedIp, macAddress: state.normalizedMac },
      "LG TV nicht mehr über mDNS erreichbar (Fernseher vermutlich aus)"
    );
    this.reachabilityCallback?.(deviceId);
  }

  public async startDiscovery(timeoutSeconds: number): Promise<LGDeviceDiscovered[]> {
    logger.info({ serviceType: LGDeviceDiscover.SERVICE_TYPE }, "Starte mDNS-Discovery fuer LG-TVs");
    const devicesMap = new Map<string, LGDeviceDiscovered>();
    const mdnsInstances: MdnsInstance[] = [];
    const timers: Array<NodeJS.Timeout> = [];
    const serviceCache = new Map<string, ServiceCache>();

    const handleResponse = (response: { answers?: any[]; additionals?: any[] }) => {
      this.ingestMdnsResponse(response, serviceCache, device => {
        if (devicesMap.has(device.address)) return;
        devicesMap.set(device.address, device);
        logger.info({ host: device.address, port: device.port }, "LG-Geraet gefunden");
      });
    };

    try {
      for (const { instance, ifaceLabel } of createMdnsSocketsForDiscovery()) {
        mdnsInstances.push(instance);
        instance.on("response", handleResponse);

        const query = () => {
          instance.query({
            questions: [{ name: LGDeviceDiscover.SERVICE_TYPE, type: "PTR" }],
          });
        };
        query();
        const timer = setInterval(query, timeoutSeconds * 1000);
        timers.push(timer);
        logger.info(
          { iface: ifaceLabel, serviceType: LGDeviceDiscover.SERVICE_TYPE },
          "JmDNS mDNS Discovery gestartet"
        );
      }

      if (!mdnsInstances.length) {
        logger.warn("Konnte keine mDNS-Instanz fuer Discovery erzeugen");
      } else {
        await new Promise(resolve => setTimeout(resolve, timeoutSeconds * 1000));
        logger.info({ count: devicesMap.size }, "mDNS-Discovery beendet");
      }
    } catch (err) {
      logger.error({ err }, "Fehler bei der mDNS-Discovery");
    } finally {
      timers.forEach(timer => clearInterval(timer));
      mdnsInstances.forEach(instance => {
        try {
          instance.removeAllListeners();
          instance.destroy();
        } catch (err) {
          logger.warn({ err }, "Fehler beim Schliessen von mDNS");
        }
      });
    }

    return Array.from(devicesMap.values());
  }

  public async stopDiscovery(): Promise<void> {
    // Cleanup wird bereits in startDiscovery durchgeführt
    return;
  }
}
