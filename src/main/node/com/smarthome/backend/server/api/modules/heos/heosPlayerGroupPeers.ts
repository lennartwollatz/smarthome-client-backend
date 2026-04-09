import type { DeviceManager } from "../../entities/devices/deviceManager.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";

export function normalizeHeosHost(addr: string | undefined | null): string {
  if (addr == null || addr === "") return "";
  return addr.replace(/^\[|\]$/g, "").trim().toLowerCase();
}

/**
 * HEOS-Gruppen-Player-PIDs → Smarthome-`Device.id` am selben Host (Denon-Lautsprecher und -Receiver).
 */
export function resolveHeosGroupPeerDeviceIds(
  dm: DeviceManager | undefined,
  moduleId: string,
  selfId: string,
  selfAddress: string | undefined | null,
  selfPid: number,
  groupPids: string[]
): string[] {
  const selfHost = normalizeHeosHost(selfAddress);
  if (!dm || !moduleId || !selfHost) {
    return [];
  }
  const ids: string[] = [];
  for (const pidStr of groupPids) {
    if (pidStr === String(selfPid)) {
      continue;
    }
    const peer = dm.getDevicesForModule(moduleId).find((d) => {
      if (d.id === selfId) return false;
      const t = d.type;
      if (t !== DeviceType.SPEAKER && t !== DeviceType.SPEAKER_RECEIVER) {
        return false;
      }
      const pid = (d as { pid?: number }).pid ?? 0;
      const addr = (d as { address?: string }).address;
      return normalizeHeosHost(addr) === selfHost && String(pid) === pidStr;
    });
    if (peer?.id) {
      ids.push(peer.id);
    }
  }
  return ids;
}
