import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { WACLightingDeviceDiscovered } from "./waclightingDeviceDiscovered.js";
import { ModuleDeviceDiscover } from "../moduleDeviceDiscover.js";
import { WACLIGHTINGCONFIG, WACLIGHTINGMODULE } from "./waclightingModule.js";
import mdns from "multicast-dns";
import os from "os";
import { WACLightingDeviceController } from "./waclightingDeviceController.js";

type MdnsInstance = ReturnType<typeof mdns>;

export class WACLightingDeviceDiscover extends ModuleDeviceDiscover<WACLightingDeviceDiscovered> {
  private static SERVICE_TYPE = "_easylink._tcp.local";
  
  private mdnsInstances: MdnsInstance[] = [];
  private mdnsTimers: Array<NodeJS.Timeout> = [];
  private devicesMap = new Map<string, WACLightingDeviceDiscovered>();
  private controller: WACLightingDeviceController;

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
    this.controller = new WACLightingDeviceController();
  }

  getModuleName(): string {
    return WACLIGHTINGMODULE.name;
  }

  getDiscoveredDeviceTypeName(): string {
    return WACLIGHTINGCONFIG.deviceTypeName;
  }

  public async startDiscovery(timeoutSeconds: number): Promise<WACLightingDeviceDiscovered[]> {
    logger.info("Starte WAC Lighting mDNS Discovery via _easylink._tcp.local");
    this.devicesMap.clear();

    const handleResponse = (response: any) => {
      logger.debug({ response }, "WAC Lighting mDNS Response");
      try {
        // Bonjour-ähnliches Response-Format (wie in der API-Doku)
        let serviceName: string | undefined = this.pickServiceName(response);
        let ip: string | undefined = this.pickIpv4(response);
        let port: number | undefined = typeof response?.port === "number" ? response.port : undefined;
        let discoveredType: string | undefined = normalizeLower(response?.type);
        let discoveredProtocol: string | undefined = normalizeLower(response?.protocol);

        const txtData: Record<string, string> = {};
        const responseTxt = response?.txt;
        if (responseTxt && typeof responseTxt === "object") {
          Object.entries(responseTxt as Record<string, unknown>).forEach(([key, value]) => {
            const normalizedKey = String(key).trim();
            const normalizedValue = String(value ?? "");
            if (normalizedKey.length) {
              txtData[normalizedKey] = normalizedValue;
              txtData[normalizedKey.toLowerCase()] = normalizedValue;
            }
          });
        }

        // multicast-dns Paketformat
        const answers = response.answers ?? [];
        const additionals = response.additionals ?? [];
        const records = [...answers, ...additionals];

        // Parse mDNS response
        records.forEach((answer: any) => {
          if (answer.type === "PTR" && answer.name === WACLightingDeviceDiscover.SERVICE_TYPE) {
            serviceName = answer.data;
          }
          if (answer.type === "A" && answer.data) {
            ip = answer.data;
          }
          if (answer.type === "SRV" && answer.data) {
            port = answer.data.port;
          }
          if (answer.type === "TXT" && Array.isArray(answer.data)) {
            answer.data.forEach((entry: Buffer | string) => {
              const text = Buffer.isBuffer(entry) ? entry.toString("utf8") : String(entry);
              const [key, value] = text.split("=", 2);
              if (key) {
                txtData[key] = value ?? "";
                txtData[key.toLowerCase()] = value ?? "";
              }
            });
          }
        });

        // Falls type/protocol nicht direkt vorhanden, aus FQDN ableiten:
        // z.B. WAC_Fan_XXXXXX._easylink._tcp.local
        const identityFromFqdn = this.extractIdentityFromFqdn(serviceName);
        const deviceType = discoveredType ?? identityFromFqdn.type;
        const protocol = discoveredProtocol ?? identityFromFqdn.protocol;

        // Nur WAC/Modern Forms easylink TCP-Geräte akzeptieren
        if (deviceType !== "easylink" || protocol !== "tcp") {
          return;
        }

        if (ip) {
          this.handleDeviceFound(ip, port ?? 80, txtData, serviceName);
        }
      } catch (err) {
        logger.debug({ err }, "Fehler beim Verarbeiten der mDNS-Response");
      }
    };

    try {
      const interfaces = os.networkInterfaces();
      Object.values(interfaces).forEach(iface => {
        (iface ?? []).forEach(addr => {
          if (addr.internal) return;
          if (addr.family !== "IPv4") return;
          try {
            const instance = mdns({ interface: addr.address });
            this.mdnsInstances.push(instance);
            instance.on("response", handleResponse);

            const query = () => {
              instance.query({
                questions: [{ name: WACLightingDeviceDiscover.SERVICE_TYPE, type: "PTR" }]
              });
            };
            query();
            const timer = setInterval(query, timeoutSeconds * 1000);
            this.mdnsTimers.push(timer);
            logger.info(
              { iface: addr.address, serviceType: WACLightingDeviceDiscover.SERVICE_TYPE },
              "WAC Lighting mDNS Discovery gestartet"
            );
          } catch (err) {
            logger.warn({ err, iface: addr.address }, "Konnte mDNS nicht starten");
          }
        });
      });

      if (!this.mdnsInstances.length) {
        logger.warn("Konnte keine mDNS-Instanz für WAC Lighting Discovery erzeugen");
      } else {
        await new Promise(resolve => setTimeout(resolve, timeoutSeconds * 1000));
        logger.info({ count: this.devicesMap.size }, "WAC Lighting mDNS-Discovery beendet");
      }
    } catch (err) {
      logger.error({ err }, "Fehler bei der WAC Lighting mDNS-Discovery");
    } finally {
      this.stopMdnsDiscovery();
    }

    return Array.from(this.devicesMap.values());
  }

  private async handleDeviceFound(
    ip: string, 
    port: number, 
    txtData: Record<string, string>,
    serviceName?: string
  ) {
    try {
      // Erstelle eine vorläufige Device-ID aus der IP
      const tempId = `waclighting-${ip.replace(/\./g, "-")}`;
      
      if (this.devicesMap.has(tempId)) {
        return; // Gerät bereits gefunden
      }

      // Hole zusätzliche Informationen vom Gerät
      const config = await this.controller.getConfig(ip, port);
      const staticData = await this.controller.getStaticShadowData(ip, port);

      // Extrahiere Informationen
      const clientId = (config?.clientId ?? txtData.clientId) as string | undefined;
      const mac = (config?.macAddress ?? txtData.mac) as string | undefined;
      const name = (config?.deviceName ?? serviceName ?? `WAC Device ${ip}`) as string;
      const model = (staticData?.model ?? txtData.model) as string | undefined;
      const manufacturer = "WAC Lighting";

      // Erstelle Device-Objekt
      const device = new WACLightingDeviceDiscovered(
        tempId,
        name,
        ip,
        port,
        mac,
        model,
        manufacturer,
        clientId
      );

      // Erweiterte Informationen aus config-read
      if (config) {
        device.fanInstalled = config.fanInstalled === 1;
        device.lightInstalled = config.lightInstalled === 1;
        device.hasFan = config.fanInstalled === 1;
        device.hasLight = config.lightInstalled === 1;
      }

      // Statische Daten
      if (staticData) {
        device.firmwareVersion = staticData.firmwareVersion as string | undefined;
        device.productType = staticData.productType as string | undefined;
      }

      this.devicesMap.set(tempId, device);
      logger.info({ deviceId: tempId, ip, name }, "WAC Lighting-Gerät gefunden");
    } catch (err) {
      logger.debug({ err, ip }, "Fehler beim Verarbeiten des WAC Lighting-Geräts");
    }
  }

  public async stopDiscovery(): Promise<void> {
    this.stopMdnsDiscovery();
  }

  private stopMdnsDiscovery() {
    this.mdnsTimers.forEach(timer => clearInterval(timer));
    this.mdnsTimers = [];
    this.mdnsInstances.forEach(instance => {
      try {
        instance.destroy();
      } catch (err) {
        logger.debug({ err }, "Fehler beim Beenden der mDNS-Instanz");
      }
    });
    this.mdnsInstances = [];
  }

  private pickServiceName(response: any): string | undefined {
    const fqdn = typeof response?.fqdn === "string" ? response.fqdn : undefined;
    const name = typeof response?.name === "string" ? response.name : undefined;
    if (fqdn) return fqdn;
    if (name) return name;
    return undefined;
  }

  private pickIpv4(response: any): string | undefined {
    const addresses = Array.isArray(response?.addresses) ? response.addresses : [];
    const ipv4 = addresses.find((address: unknown) =>
      typeof address === "string" && /^\d{1,3}(\.\d{1,3}){3}$/.test(address)
    ) as string | undefined;
    if (ipv4) return ipv4;
    const refererAddress =
      typeof response?.referer?.address === "string" ? response.referer.address : undefined;
    return refererAddress;
  }

  private extractIdentityFromFqdn(value?: string): { type?: string; protocol?: string } {
    if (!value) return {};
    const lower = value.toLowerCase();
    const marker = "._";
    const idx = lower.indexOf(marker);
    if (idx < 0) return {};
    const servicePart = lower.slice(idx + marker.length); // z.B. easylink._tcp.local
    const parts = servicePart.split(".");
    if (parts.length < 2) return {};
    const type = parts[0];
    const protocol = parts[1].startsWith("_") ? parts[1].slice(1) : parts[1];
    return { type, protocol };
  }
}

function normalizeLower(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : undefined;
}

