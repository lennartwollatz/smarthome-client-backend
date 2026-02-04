import dgram from "node:dgram";
import net from "node:net";
import os from "node:os";
import {
  ChannelType,
  MAX_UDP_MESSAGE_SIZE,
  Network,
  type NetworkInterface,
  type NetworkInterfaceDetails,
  type UdpChannel,
  type UdpChannelOptions
} from "@matter/general";

type SocketType = "udp4" | "udp6";

export class NodeNetwork extends Network {
  async getNetInterfaces(configuration?: NetworkInterface[]) {
    const interfaces = os.networkInterfaces();
    const names = Object.keys(interfaces);
    if (configuration && configuration.length > 0) {
      const configMap = new Map(configuration.map(entry => [entry.name, entry.type]));
      return names
        .filter(name => configMap.has(name))
        .map(name => ({ name, type: configMap.get(name) }));
    }
    return names.map(name => ({ name }));
  }

  async getIpMac(netInterface: string): Promise<NetworkInterfaceDetails | undefined> {
    const interfaces = os.networkInterfaces();
    const entries = interfaces[netInterface];
    if (!entries || entries.length === 0) return undefined;

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
    const socket = dgram.createSocket({
      type: socketType,
      reuseAddr: options.reuseAddress,
      ipv6Only: socketType === "udp6" ? false : undefined
    });
    await bindSocket(socket, options.listeningPort, options.listeningAddress);
    return new NodeUdpChannel(socket, socketType, options.netInterface);
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
  }

  addMembership(address: string) {
    if (this.netInterface) {
      this.socket.addMembership(address, this.netInterface);
    } else {
      this.socket.addMembership(address);
    }
  }

  dropMembership(address: string) {
    if (this.netInterface) {
      this.socket.dropMembership(address, this.netInterface);
    } else {
      this.socket.dropMembership(address);
    }
  }

  onData(listener: (netInterface: string | undefined, peerAddress: string, peerPort: number, data: Uint8Array) => void) {
    const handler = (message: Buffer, remoteInfo: dgram.RemoteInfo) => {
      listener(this.netInterface, remoteInfo.address, remoteInfo.port, new Uint8Array(message));
    };
    this.socket.on("message", handler);
    return {
      close: async () => {
        this.socket.off("message", handler);
      }
    };
  }

  async send(host: string, port: number, data: Uint8Array) {
    await new Promise<void>((resolve, reject) => {
      this.socket.send(Buffer.from(data), port, host, err => {
        if (err) reject(err);
        else resolve();
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
    if (this.socketType === "udp4") return !isIpv6;
    return true;
  }
}

function resolveSocketType(type: UdpChannelOptions["type"]): SocketType {
  if (type === "udp4") return "udp4";
  if (type === "udp6") return "udp6";
  return "udp6";
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

