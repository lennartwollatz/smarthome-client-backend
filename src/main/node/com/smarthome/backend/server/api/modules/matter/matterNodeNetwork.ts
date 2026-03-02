import dgram from "node:dgram";
import net from "node:net";
import os from "node:os";
import {
  ChannelType,
  MAX_UDP_MESSAGE_SIZE,
  Network,
  NoAddressAvailableError,
  type NetworkInterface,
  type NetworkInterfaceDetails,
  type UdpChannel,
  type UdpChannelOptions
} from "@matter/general";

type SocketType = "udp4" | "udp6";

function isLanOrWlanInterface(name: string) {
  const normalized = name.toLowerCase();
  return (
    normalized.includes("wlan") ||
    normalized.includes("wi-fi") ||
    normalized.includes("wifi") ||
    normalized.includes("lan") ||
    normalized.includes("ethernet")
  );
}

export class NodeNetwork extends Network {
  async getNetInterfaces(configuration?: NetworkInterface[]) {
    const interfaces = os.networkInterfaces();
    const names = Object.keys(interfaces);
    const allowedNames = names.filter(isLanOrWlanInterface);
    if (configuration && configuration.length > 0) {
      const configMap = new Map(configuration.map(entry => [entry.name, entry.type]));
      const filtered = allowedNames
        .filter(name => configMap.has(name))
        .map(name => ({ name, type: configMap.get(name) }));
      return filtered;
    }
    const all = allowedNames.map(name => ({ name }));
    return all;
  }

  async getIpMac(netInterface: string): Promise<NetworkInterfaceDetails | undefined> {
    const interfaces = os.networkInterfaces();
    const entries = interfaces[netInterface];
    if (!entries || entries.length === 0) {
      return undefined;
    }

    const ipV4: string[] = [];
    const ipV6: string[] = [];
    let mac = "";

    entries.forEach(entry => {
      if (!entry) return;
      if (entry.internal) return;
      if (!mac && entry.mac) mac = entry.mac;
      if (entry.family === "IPv4") {
        ipV4.push(entry.address);
      } else if (entry.family === "IPv6") {
        ipV6.push(entry.address);
      }
    });

    if (!mac && entries[0]?.mac) {
      mac = entries[0].mac ?? "";
    }

    return { mac, ipV4, ipV6 };
  }

  async createUdpChannel(options: UdpChannelOptions): Promise<UdpChannel> {
    const socketType = resolveSocketType(options.type);
    const requestedNetInterface = options.netInterface;
    const sanitizedRequestedInterface =
      requestedNetInterface && isLanOrWlanInterface(requestedNetInterface) ? requestedNetInterface : undefined;
    const resolvedNetInterface = sanitizedRequestedInterface ?? resolveDefaultNetInterface(socketType);
    if (!resolvedNetInterface) {
      throw new NoAddressAvailableError(`No LAN/WLAN interface available for ${socketType}`);
    }
    const socket = dgram.createSocket({
      type: socketType,
      reuseAddr: options.reuseAddress,
      ipv6Only: socketType === "udp6" ? false : undefined
    });
    await bindSocket(socket, options.listeningPort, options.listeningAddress);
    return new NodeUdpChannel(socket, socketType, resolvedNetInterface);
  }
}

class NodeUdpChannel implements UdpChannel {
  maxPayloadSize = MAX_UDP_MESSAGE_SIZE;
  private socket: dgram.Socket;
  private socketType: SocketType;
  private netInterface?: string;

  constructor(socket: dgram.Socket, socketType: SocketType, netInterface?: string) {
    this.socket = socket;
    this.socketType = socketType;
    this.netInterface = netInterface;
    this.configureMulticastInterface();
  }

  addMembership(address: string) {
    const membershipInterface = resolveMembershipInterface(this.socketType, this.netInterface);
    if (membershipInterface) {
      this.socket.addMembership(address, membershipInterface);
    } else {
      this.socket.addMembership(address);
    }
  }

  dropMembership(address: string) {
    const membershipInterface = resolveMembershipInterface(this.socketType, this.netInterface);
    if (membershipInterface) {
      this.socket.dropMembership(address, membershipInterface);
    } else {
      this.socket.dropMembership(address);
    }
  }

  onData(listener: (netInterface: string | undefined, peerAddress: string, peerPort: number, data: Uint8Array) => void) {
    const handler = (message: Buffer, remoteInfo: dgram.RemoteInfo) => {
      // IPv4-mapped IPv6-Adressen (::ffff:x.x.x.x) zurück in reine IPv4 umwandeln
      let address = remoteInfo.address;
      if (address.startsWith("::ffff:")) {
        address = address.slice(7);
      }
      if (remoteInfo.port === 5353) {
        parseDnsPacketSummary(new Uint8Array(message));
      }
      listener(this.netInterface, address, remoteInfo.port, new Uint8Array(message));
    };
    this.socket.on("message", handler);
    return {
      close: async () => {
        this.socket.off("message", handler);
      }
    };
  }

  async send(host: string, port: number, data: Uint8Array) {
    // Auf einem udp6/Dual-Stack-Socket müssen IPv4-Adressen als IPv4-mapped
    // IPv6-Adressen gesendet werden (::ffff:x.x.x.x), da Windows bei
    // direktem Send an eine IPv4-Adresse EINVAL liefert.
    let targetHost = host;
    if (this.socketType === "udp6" && net.isIPv4(host)) {
      targetHost = `::ffff:${host}`;
    }
    await new Promise<void>((resolve, reject) => {
      this.socket.send(Buffer.from(data), port, targetHost, err => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async close() {
    await new Promise<void>(resolve => {
      this.socket.close(() => resolve());
    });
  }

  get port() {
    return this.socket.address().port;
  }

  supports(type: ChannelType, address?: string) {
    if (type !== ChannelType.UDP) return false;
    if (!address) return true;
    const isIpv6 = net.isIPv6(address) || address.includes(":");
    const supported = this.socketType === "udp4" ? !isIpv6 : true;
    return supported;
  }

  private configureMulticastInterface() {
    const multicastInterface = resolveMulticastInterface(this.socketType, this.netInterface);
    if (!multicastInterface) {
      return;
    }
    try {
      this.socket.setMulticastInterface(multicastInterface);
    } catch {
      // Wenn die Interface-Vorgabe vom OS nicht akzeptiert wird,
      // auf das System-Default-Fallback zurückfallen.
    }
  }
}

function resolveSocketType(type: UdpChannelOptions["type"]): SocketType {
  if (type === "udp4") {
    return "udp4";
  }
  if (type === "udp6") {
    return "udp6";
  }
  return "udp6";
}

function resolveDefaultNetInterface(socketType: SocketType): string | undefined {
  const family = socketType === "udp4" ? "IPv4" : "IPv6";
  const interfaces = os.networkInterfaces();
  for (const [name, entries] of Object.entries(interfaces)) {
    if (!isLanOrWlanInterface(name)) {
      continue;
    }
    if (!entries) continue;
    const hasFamily = entries.some(entry => entry && !entry.internal && entry.family === family);
    if (hasFamily) {
      return name;
    }
  }
  return undefined;
}

function resolveMembershipInterface(socketType: SocketType, netInterface?: string): string | undefined {
  if (!netInterface) {
    return undefined;
  }
  if (socketType === "udp6") {
    // Für IPv6-Multicast ist der zweite Parameter bei addMembership auf Windows
    // häufig nicht kompatibel (EINVAL). Ohne Parameter nutzt Node den System-Default.
    return undefined;
  }
  const addresses = os.networkInterfaces()[netInterface] ?? [];
  const ipv4Entry = addresses.find(entry => entry && !entry.internal && entry.family === "IPv4");
  const result = ipv4Entry?.address;
  return result;
}

function resolveMulticastInterface(socketType: SocketType, netInterface?: string): string | undefined {
  if (!netInterface) {
    return undefined;
  }
  const addresses = os.networkInterfaces()[netInterface] ?? [];
  if (socketType === "udp4") {
    const ipv4Entry = addresses.find(entry => entry && !entry.internal && entry.family === "IPv4");
    const result = ipv4Entry?.address;
    return result;
  }

  // Für ff02::/16 ist eine eindeutige Scope-Zuordnung wichtig;
  // deshalb bevorzugen wir eine Link-Local-Adresse mit Scope-ID.
  const ipv6Entries = addresses.filter(
    (entry): entry is os.NetworkInterfaceInfoIPv6 => !!entry && !entry.internal && entry.family === "IPv6"
  );
  const linkLocal = ipv6Entries.find(entry => entry.address.toLowerCase().startsWith("fe80:"));
  const selected = linkLocal ?? ipv6Entries[0];
  if (!selected) {
    return undefined;
  }
  if (typeof selected.scopeid === "number" && selected.scopeid > 0) {
    const scoped = `${selected.address}%${selected.scopeid}`;
    return scoped;
  }
  return selected.address;
}

async function bindSocket(socket: dgram.Socket, port?: number, address?: string) {
  await new Promise<void>((resolve, reject) => {
    socket.once("error", reject);
    socket.bind(port ?? 0, address ?? undefined, () => {
      socket.off("error", reject);
      resolve();
    });
  });
}

type DnsRecordSummary = {
  name: string;
  type: string;
  classCode: number;
  ttl?: number;
  data?: string | number | string[] | { port: number; target: string };
};

type DnsPacketSummary = {
  transactionId: number;
  flags: number;
  questions: DnsRecordSummary[];
  answers: DnsRecordSummary[];
  authority: DnsRecordSummary[];
  additional: DnsRecordSummary[];
  announced: {
    services: string[];
    operationalInstances: string[];
  };
};

function parseDnsPacketSummary(data: Uint8Array): DnsPacketSummary | null {
  if (data.length < 12) {
    return null;
  }
  try {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;
    const transactionId = view.getUint16(offset);
    offset += 2;
    const flags = view.getUint16(offset);
    offset += 2;
    const questionCount = view.getUint16(offset);
    offset += 2;
    const answerCount = view.getUint16(offset);
    offset += 2;
    const authorityCount = view.getUint16(offset);
    offset += 2;
    const additionalCount = view.getUint16(offset);
    offset += 2;

    const questions: DnsRecordSummary[] = [];
    for (let i = 0; i < questionCount; i++) {
      const nameResult = readDnsName(data, offset);
      offset = nameResult.nextOffset;
      if (offset + 4 > data.length) return null;
      const typeCode = view.getUint16(offset);
      offset += 2;
      const classCode = view.getUint16(offset);
      offset += 2;
      questions.push({
        name: nameResult.name,
        type: dnsTypeName(typeCode),
        classCode: classCode & 0x7fff
      });
    }

    const searchedInstances = questions
      .map(question => question.name)
      .filter(name => name.endsWith("._matter._tcp.local"));
    for (const instance of searchedInstances) {
      console.log("Suche nach Matter-Instanz:", instance);
    }

    const answers = readDnsResourceRecords(data, view, offset, answerCount);
    offset = answers.nextOffset;
    const authority = readDnsResourceRecords(data, view, offset, authorityCount);
    offset = authority.nextOffset;
    const additional = readDnsResourceRecords(data, view, offset, additionalCount);
    const announced = collectAnnouncedRecords([
      ...answers.records,
      ...authority.records,
      ...additional.records
    ]);

    return {
      transactionId,
      flags,
      questions,
      answers: answers.records,
      authority: authority.records,
      additional: additional.records,
      announced
    };
  } catch {
    return null;
  }
}

function readDnsResourceRecords(
  data: Uint8Array,
  view: DataView,
  startOffset: number,
  count: number
): { records: DnsRecordSummary[]; nextOffset: number } {
  let offset = startOffset;
  const records: DnsRecordSummary[] = [];

  for (let i = 0; i < count; i++) {
    const nameResult = readDnsName(data, offset);
    offset = nameResult.nextOffset;
    if (offset + 10 > data.length) {
      throw new Error("Invalid DNS RR header length");
    }
    const typeCode = view.getUint16(offset);
    offset += 2;
    const classCode = view.getUint16(offset);
    offset += 2;
    const ttl = view.getUint32(offset);
    offset += 4;
    const rdLength = view.getUint16(offset);
    offset += 2;
    if (offset + rdLength > data.length) {
      throw new Error("Invalid DNS RDATA length");
    }
    const rdataOffset = offset;
    const dataValue = parseDnsRecordData(data, view, typeCode, rdataOffset, rdLength);
    offset += rdLength;

    records.push({
      name: nameResult.name,
      type: dnsTypeName(typeCode),
      classCode: classCode & 0x7fff,
      ttl,
      data: dataValue
    });
  }

  return { records, nextOffset: offset };
}

function parseDnsRecordData(
  data: Uint8Array,
  view: DataView,
  typeCode: number,
  rdataOffset: number,
  rdLength: number
): DnsRecordSummary["data"] {
  if (rdLength <= 0) {
    return undefined;
  }
  if (typeCode === 12) {
    return readDnsName(data, rdataOffset).name;
  }
  if (typeCode === 33) {
    if (rdLength < 6) {
      return undefined;
    }
    const port = view.getUint16(rdataOffset + 4);
    const target = readDnsName(data, rdataOffset + 6).name;
    return { port, target };
  }
  if (typeCode === 1 && rdLength === 4) {
    return Array.from(data.slice(rdataOffset, rdataOffset + rdLength)).join(".");
  }
  if (typeCode === 28 && rdLength === 16) {
    const parts: string[] = [];
    for (let i = 0; i < 16; i += 2) {
      parts.push(view.getUint16(rdataOffset + i).toString(16));
    }
    return parts.join(":");
  }
  if (typeCode === 16) {
    const strings: string[] = [];
    let cursor = rdataOffset;
    const end = rdataOffset + rdLength;
    while (cursor < end) {
      const txtLength = data[cursor];
      cursor += 1;
      if (cursor + txtLength > end) {
        break;
      }
      strings.push(Buffer.from(data.slice(cursor, cursor + txtLength)).toString("utf8"));
      cursor += txtLength;
    }
    return strings;
  }
  return undefined;
}

function collectAnnouncedRecords(records: DnsRecordSummary[]) {
  const services = new Set<string>();
  const operationalInstances = new Set<string>();

  for (const record of records) {
    if (record.type !== "PTR" || typeof record.data !== "string") {
      continue;
    }
    services.add(record.name);
    if (record.name.endsWith("._matter._tcp.local")) {
      operationalInstances.add(record.data);
    }
  }

  return {
    services: Array.from(services).sort(),
    operationalInstances: Array.from(operationalInstances).sort()
  };
}

function readDnsName(data: Uint8Array, startOffset: number): { name: string; nextOffset: number } {
  const labels: string[] = [];
  let offset = startOffset;
  let jumped = false;
  let nextOffset = startOffset;
  let guard = 0;

  while (offset < data.length && guard < 128) {
    guard++;
    const length = data[offset];

    if (length === 0) {
      if (!jumped) {
        nextOffset = offset + 1;
      }
      const name = labels.length > 0 ? labels.join(".") : ".";
      return { name, nextOffset };
    }

    const isPointer = (length & 0xc0) === 0xc0;
    if (isPointer) {
      if (offset + 1 >= data.length) {
        throw new Error("Invalid DNS name pointer");
      }
      const pointer = ((length & 0x3f) << 8) | data[offset + 1];
      if (!jumped) {
        nextOffset = offset + 2;
      }
      offset = pointer;
      jumped = true;
      continue;
    }

    const labelLength = length;
    offset += 1;
    if (offset + labelLength > data.length) {
      throw new Error("Invalid DNS label length");
    }
    const labelBytes = data.slice(offset, offset + labelLength);
    labels.push(Buffer.from(labelBytes).toString("utf8"));
    offset += labelLength;
    if (!jumped) {
      nextOffset = offset;
    }
  }

  throw new Error("DNS name parsing exceeded bounds");
}

function dnsTypeName(typeCode: number): string {
  const typeMap: Record<number, string> = {
    1: "A",
    12: "PTR",
    16: "TXT",
    28: "AAAA",
    33: "SRV",
    41: "OPT",
    47: "NSEC"
  };
  return typeMap[typeCode] ?? `TYPE_${typeCode}`;
}

