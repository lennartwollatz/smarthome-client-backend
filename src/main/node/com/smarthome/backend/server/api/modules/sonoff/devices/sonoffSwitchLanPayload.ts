/**
 * LAN/mDNS: Form wie ``{ switches: [{ switch, outlet }, …], ssid, bssid }`` aus getState-/Stream-Payloads ableiten.
 */
export function normalizeSonoffSwitchLanPayload(raw: Record<string, unknown>): Record<string, unknown> | null {
  const topSwitches = Array.isArray(raw.switches) ? (raw.switches as unknown[]) : null;
  const bi = raw.basicInfo as Record<string, unknown> | undefined;
  const biSwitches = bi && Array.isArray(bi.switches) ? (bi.switches as unknown[]) : null;

  const swList =
    topSwitches && topSwitches.length > 0
      ? topSwitches
      : biSwitches && biSwitches.length > 0
        ? biSwitches
        : null;
  if (!swList?.length) {
    return null;
  }

  const ssid =
    typeof raw.ssid === "string" ? raw.ssid : typeof bi?.ssid === "string" ? (bi.ssid as string) : undefined;
  const bssid =
    typeof raw.bssid === "string"
      ? raw.bssid
      : typeof bi?.bssid === "string"
        ? (bi.bssid as string)
        : undefined;

  if (typeof ssid !== "string" || typeof bssid !== "string") {
    return null;
  }

  return {
    switches: swList as Record<string, unknown>[],
    ssid,
    bssid,
  };
}

export function isSonoffSwitchLanPayloadOk(p: Record<string, unknown> | null | undefined): boolean {
  if (!p) {
    return false;
  }
  if (p.ok === true) {
    return true;
  }
  return normalizeSonoffSwitchLanPayload(p) !== null;
}
