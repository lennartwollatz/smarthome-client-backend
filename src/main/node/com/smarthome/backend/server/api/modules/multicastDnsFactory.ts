import os from "node:os";
import mdns from "multicast-dns";

export type MdnsInstance = ReturnType<typeof mdns>;

export type MdnsSocketEntry = { instance: MdnsInstance; ifaceLabel: string };

/**
 * mDNS-Sockets für Discovery: Auf Linux eine Instanz ohne Bind an eine einzelne IPv4,
 * damit Multicast-Antworten zuverlässig ankommen (vergleichbar zu avahi-browse).
 * Auf Windows/macOS weiterhin eine Instanz pro nicht-interner IPv4-Adresse.
 */
export function createMdnsSocketsForDiscovery(): MdnsSocketEntry[] {
  const out: MdnsSocketEntry[] = [];
  if (os.platform() === "linux") {
    try {
      out.push({ instance: mdns({}), ifaceLabel: "0.0.0.0 (alle IPv4-Schnittstellen)" });
    } catch {
      /* Aufrufer loggt leere Instanzliste */
    }
    return out;
  }
  const interfaces = os.networkInterfaces();
  Object.values(interfaces).forEach(iface => {
    (iface ?? []).forEach(addr => {
      if (addr.internal) return;
      if (addr.family !== "IPv4") return;
      try {
        out.push({ instance: mdns({ interface: addr.address }), ifaceLabel: addr.address });
      } catch {
        /* ignore */
      }
    });
  });
  return out;
}
