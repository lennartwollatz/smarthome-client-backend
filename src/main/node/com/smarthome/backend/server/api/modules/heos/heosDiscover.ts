import os from "node:os";
import crypto from "node:crypto";
import mdns from "multicast-dns";
import { logger } from "../../../../logger.js";
import { HeosController } from "./heosController.js";
import { HeosDiscoveredDevice } from "./heosDiscoveredDevice.js";

type MdnsInstance = ReturnType<typeof mdns>;

type ServiceCache = {
  name: string;
  host?: string;
  port?: number;
  txt?: Record<string, string>;
  ipv4?: string;
  ipv6?: string;
};

export abstract class HeosDiscover {
  protected devices = new Map<string, HeosDiscoveredDevice>();
  protected manufacturer: string;
  private mdnsInstances: MdnsInstance[] = [];
  private mdnsTimers: Array<NodeJS.Timeout> = [];
  private serviceCache = new Map<string, ServiceCache>();
  private currentRunId: string | null = null;
  private currentRunStartMs = 0;
  private playerInfoSuccess = 0;
  private playerInfoFailure = 0;

  protected constructor(manufacturer: string) {
    this.manufacturer = manufacturer;
  }

  private runTag() {
    return this.currentRunId ? `[run=${this.currentRunId}] ` : "";
  }

  private getMdnsServiceType() {
    return "_airplay._tcp.local";
  }

  private matchesManufacturer(txt?: Record<string, string>) {
    if (!txt || !this.manufacturer) {
      return false;
    }
    const deviceManufacturer = txt.manufacturer ?? "";
    if (!deviceManufacturer) {
      return false;
    }
    const matches = deviceManufacturer.toLowerCase() === this.manufacturer.toLowerCase();
    if (!matches) {
      logger.debug(
        { expected: this.manufacturer, found: deviceManufacturer },
        `${this.runTag()}mDNS manufacturer mismatch`
      );
    }
    return matches;
  }

  private startMdnsDiscovery() {
    this.stopMdnsDiscovery();
    const serviceType = this.getMdnsServiceType();

    const interfaces = os.networkInterfaces();
    Object.values(interfaces).forEach(iface => {
      (iface ?? []).forEach(addr => {
        if (addr.internal) return;
        if (addr.family !== "IPv4") return;
        try {
          const instance = mdns({ interface: addr.address });
          this.mdnsInstances.push(instance);
          instance.on("response", (response: any) => {
            this.handleMdnsResponse(response);
          });
          // query periodically while discovery is active
          const query = () => {
            instance.query({ questions: [{ name: serviceType, type: "PTR" }] });
          };
          query();
          const timer = setInterval(query, 2000);
          this.mdnsTimers.push(timer);
          logger.info(
            { iface: addr.address, serviceType },
            `${this.runTag()}mDNS Discovery gestartet`
          );
        } catch (err) {
          logger.warn(
            { err, iface: addr.address },
            `${this.runTag()}Konnte mDNS auf Interface nicht starten`
          );
        }
      });
    });

    if (this.mdnsInstances.length === 0) {
      logger.warn(`${this.runTag()}Keine mDNS-Instanz fuer Discovery erzeugt`);
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
        logger.warn({ err }, `${this.runTag()}Fehler beim Schliessen von mDNS`);
      }
    });
    this.mdnsInstances = [];
  }

  private handleMdnsResponse(response: { answers?: any[]; additionals?: any[] }) {
    const records = [...(response.answers ?? []), ...(response.additionals ?? [])];
    for (const record of records) {
      if (record.type === "PTR" && typeof record.data === "string") {
        const name = record.data as string;
        this.ensureService(name);
      }
      if (record.type === "SRV") {
        const name = record.name as string;
        const entry = this.ensureService(name);
        entry.host = record.data?.target;
        entry.port = record.data?.port;
      }
      if (record.type === "TXT") {
        const name = record.name as string;
        const entry = this.ensureService(name);
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
      if (!this.matchesManufacturer(service.txt)) continue;
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
      if (key) {
        txt[key] = value ?? "";
      }
    });
    return txt;
  }

  private tryCreateDevice(serviceName: string, service: ServiceCache) {
    const txt = service.txt ?? {};
    const host = service.ipv4 ?? service.ipv6 ?? service.host ?? "";

    const deviceManufacturer = txt.manufacturer ?? "";
    const modelName = txt.model ?? "";
    const modelNumber = txt.modelNumber ?? "";
    const wlanMac = txt.wlanMac ?? "";
    const deviceId = txt.deviceId || txt.gid || txt.pi || "";
    const firmwareVersion = txt.fv ?? "";
    const serialNumber = txt.serialNumber ?? "";
    const mdnsName = serviceName;

    let ipv4Address = service.ipv4;
    let ipv6Address = service.ipv6;
    if (!ipv4Address && host && !host.includes(":")) {
      ipv4Address = host;
    }
    if (!ipv6Address && host && host.includes(":")) {
      ipv6Address = host.replace(/^\[|\]$/g, "");
    }

    let udn = txt.udn ?? "";
    if (!udn) {
      const safeHost = (ipv4Address ?? host ?? "unknown").replace(/\./g, "-");
      const safeName = serviceName.replace(/\s+/g, "-");
      udn = `mdns-${safeHost}-${safeName}`;
    }

    const friendlyName = serviceName || ipv4Address || host || "unknown";
    if (this.devices.has(udn)) {
      logger.debug(
        { udn, name: friendlyName, host },
        `${this.runTag()}mDNS Geraet bereits vorhanden`
      );
      return;
    }

    const device = new HeosDiscoveredDevice(
      udn,
      friendlyName,
      modelName,
      modelNumber,
      deviceId,
      wlanMac,
      ipv4Address ?? host
    );

    device.ipv4Address = ipv4Address;
    device.ipv6Address = ipv6Address;
    device.port = service.port;
    device.mdnsName = mdnsName;
    device.firmwareVersion = firmwareVersion;
    device.serialNumber = serialNumber;
    device.manufacturer = deviceManufacturer;

    this.devices.set(udn, device);
    logger.info(
      {
        udn,
        name: friendlyName,
        manufacturer: deviceManufacturer,
        ipv4: ipv4Address,
        ipv6: ipv6Address,
        port: service.port,
        firmwareVersion,
        serialNumber
      },
      `${this.runTag()}mDNS Geraet akzeptiert und hinzugefuegt`
    );
  }

  async discoverDevicesWithPlayerIds(searchDurationMs: number) {
    this.currentRunId = crypto.randomUUID().slice(0, 8);
    this.currentRunStartMs = Date.now();
    this.playerInfoSuccess = 0;
    this.playerInfoFailure = 0;

    logger.info(
      { durationMs: searchDurationMs },
      `${this.runTag()}Starte mDNS Discovery-Suchlauf`
    );
    this.devices.clear();
    this.serviceCache.clear();
    this.startMdnsDiscovery();

    await new Promise(resolve => setTimeout(resolve, searchDurationMs));

    const snapshot = Array.from(this.devices.values());
    logger.info(
      { count: snapshot.length },
      `${this.runTag()}Discovery-Suchlauf abgeschlossen`
    );

    const devicesWithPlayers = await this.getPlayerInfo(snapshot);
    this.stopMdnsDiscovery();
    this.currentRunId = null;
    this.currentRunStartMs = 0;
    return devicesWithPlayers;
  }

  private async getPlayerInfo(snapshot: HeosDiscoveredDevice[]) {
    const devicesWithPlayerIds: HeosDiscoveredDevice[] = [];
    for (const device of snapshot) {
      try {
        logger.debug(
          { friendlyName: device.friendlyName, address: device.address, udn: device.udn },
          `${this.runTag()}Ermittle Player-IDs`
        );
        await this.setPlayerInfo(device);
        devicesWithPlayerIds.push(device);
        this.playerInfoSuccess += 1;
        logger.info(
          { friendlyName: device.friendlyName, pid: device.pid, name: device.name },
          `${this.runTag()}Player-Informationen gesetzt`
        );
      } catch (err) {
        this.playerInfoFailure += 1;
        logger.warn(
          { err, friendlyName: device.friendlyName, address: device.address },
          `${this.runTag()}Fehler beim Abrufen der Player-IDs`
        );
      }
    }

    logger.info(
      {
        count: devicesWithPlayerIds.length,
        playerInfoSuccess: this.playerInfoSuccess,
        playerInfoFailure: this.playerInfoFailure,
        totalDevices: snapshot.length
      },
      `${this.runTag()}Discovery abgeschlossen`
    );
    return devicesWithPlayerIds;
  }

  protected async setPlayerInfo(device: HeosDiscoveredDevice) {
    const address = device.getBestConnectionAddress();
    if (!address) {
      throw new Error("Keine gueltige Adresse fuer Geraet gefunden");
    }

    const controller = new HeosController();
    const connection = controller.createTemporaryConnection(address);
    try {
      await connection.connect();
      const players = await connection.playerGetPlayers();
      if (!players.length) {
        throw new Error("Keine Player fuer Geraet gefunden");
      }

      const matching = this.findMatchingPlayer(players, device, address) ?? players[0];
      const pidValue = matching.pid ?? matching["pid"];
      const pid = typeof pidValue === "number" ? pidValue : Number(pidValue ?? 0);
      if (!pid) {
        throw new Error("PID konnte nicht extrahiert werden");
      }

      const name = typeof matching.name === "string" ? matching.name : "";
      const ip = typeof matching.ip === "string" ? matching.ip : address;
      const cleanedIp = ip.replace(/^\[|\]$/g, "");

      device.ipAddress = cleanedIp;
      device.pid = pid;
      device.name = name;
    } finally {
      try {
        await connection.disconnect();
      } catch (err) {
        logger.warn({ err, address }, "Fehler beim Trennen der Verbindung");
      }
    }
  }

  private findMatchingPlayer(
    players: Array<Record<string, unknown>>,
    device: HeosDiscoveredDevice,
    deviceAddress: string
  ) {
    const deviceSerial = device.serialNumber ?? "";
    const deviceIpv4 = device.ipv4Address ?? "";
    const deviceIpv6 = device.ipv6Address ?? "";
    for (const player of players) {
      const playerIpRaw = typeof player.ip === "string" ? player.ip : "";
      const playerIp = playerIpRaw.replace(/^\[|\]$/g, "");
      const ipMatches =
        playerIp === deviceIpv4 ||
        playerIp === deviceIpv6 ||
        playerIp === deviceAddress ||
        playerIp === device.getBestConnectionAddress();

      const playerSerial = typeof player.serial === "string" ? player.serial : "";
      const serialMatches = deviceSerial && playerSerial && deviceSerial === playerSerial;
      if (ipMatches || serialMatches) {
        return player;
      }
    }
    return null;
  }
}

