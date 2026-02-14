import os from "node:os";
import mdns from "multicast-dns";
import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { LGDeviceDiscovered } from "./lgDeviceDiscovered.js";
import { ModuleDeviceDiscover } from "../moduleDeviceDiscover.js";
import { LGMODULE } from "./lgModule.js";

type MdnsInstance = ReturnType<typeof mdns>;

type ServiceCache = {
  name: string;
  host?: string;
  port?: number;
  txt?: Record<string, string>;
  ipv4?: string;
};

export class LGDeviceDiscover extends ModuleDeviceDiscover<LGDeviceDiscovered> {
  private static SERVICE_TYPE = "_airplay._tcp.local";

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  getModuleName(): string {
    return LGMODULE.name;
  }

  getDiscoveredDeviceTypeName(): string {
    return "LGDeviceDiscovered";
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

  public async startDiscovery(timeoutSeconds: number): Promise<LGDeviceDiscovered[]> {
    logger.info({ serviceType: LGDeviceDiscover.SERVICE_TYPE }, "Starte mDNS-Discovery fuer LG-TVs");
    const devicesMap = new Map<string, LGDeviceDiscovered>();
    const mdnsInstances: MdnsInstance[] = [];
    const timers: Array<NodeJS.Timeout> = [];
    const serviceCache = new Map<string, ServiceCache>();

    const handleResponse = (response: { answers?: any[]; additionals?: any[] }) => {
      const records = [...(response.answers ?? []), ...(response.additionals ?? [])];
      for (const record of records) {
        if (record.type === "PTR" && typeof record.data === "string") {
          ensureService(record.data);
        }
        if (record.type === "SRV") {
          const entry = ensureService(record.name as string);
          entry.host = record.data?.target;
          entry.port = record.data?.port;
        }
        if (record.type === "TXT") {
          const entry = ensureService(record.name as string);
          entry.txt = parseTxt(record.data);
        }
        if (record.type === "A") {
          const entry = findServiceByHost(record.name);
          if (entry) entry.ipv4 = record.data;
        }
      }

      for (const [name, service] of serviceCache.entries()) {
        if (!service.txt || !service.ipv4) continue;
        if (!this.matchesLGDevice(service.txt)) continue;
        const host = service.ipv4;
        if (devicesMap.has(host)) continue;

        const manufacturer = service.txt.manufacturer ?? "";
        const integrator = service.txt.integrator ?? "";
        const serialNumber = service.txt.serialNumber ?? "";
        const deviceName = name || host;
        const deviceId = `lg-mdns-${host}-${serialNumber || "unknown"}`;
        let macAddress: string | null = null;
        if (serialNumber) {
          const underscoreIndex = serialNumber.lastIndexOf("_");
          if (underscoreIndex >= 0 && underscoreIndex + 1 < serialNumber.length) {
            macAddress = serialNumber.substring(underscoreIndex + 1);
          } else {
            macAddress = serialNumber;
          }
        }

        const device = new LGDeviceDiscovered(
          deviceId,
          deviceName,
          host,
          service.port ?? 8080,
          LGDeviceDiscover.SERVICE_TYPE,
          manufacturer,
          integrator,
          macAddress
        );
        devicesMap.set(host, device);
        logger.info({ host, port: service.port }, "LG-Geraet gefunden");
      }
    };

    const ensureService = (name: string) => {
      if (!serviceCache.has(name)) {
        serviceCache.set(name, { name });
      }
      return serviceCache.get(name)!;
    };

    const findServiceByHost = (host: string) => {
      for (const service of serviceCache.values()) {
        if (service.host === host) return service;
      }
      return undefined;
    };

    const parseTxt = (data: any[]): Record<string, string> => {
      const txt: Record<string, string> = {};
      (data ?? []).forEach(entry => {
        const text = Buffer.isBuffer(entry) ? entry.toString("utf8") : String(entry);
        const [key, value] = text.split("=", 2);
        if (key) txt[key] = value ?? "";
      });
      return txt;
    };

    try {
      const interfaces = os.networkInterfaces();
      Object.values(interfaces).forEach(iface => {
        (iface ?? []).forEach(addr => {
          if (addr.internal) return;
          if (addr.family !== "IPv4") return;
          try {
            const instance = mdns({ interface: addr.address });
            mdnsInstances.push(instance);
            instance.on("response", handleResponse);

            const query = () => {
              instance.query({
                questions: [{ name: LGDeviceDiscover.SERVICE_TYPE, type: "PTR" }]
              });
            };
            query();
            const timer = setInterval(query, timeoutSeconds * 1000);
            timers.push(timer);
            logger.info(
              { iface: addr.address, serviceType: LGDeviceDiscover.SERVICE_TYPE },
              "JmDNS mDNS Discovery gestartet"
            );
          } catch (err) {
            logger.warn({ err, iface: addr.address }, "Konnte mDNS nicht starten");
          }
        });
      });

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

