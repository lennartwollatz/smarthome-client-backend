/**
 * Registriert der {@link import("../modules/matter/matterSwitchBindingManager.js").MatterSwitchBindingManager},
 * werden nach Workflows-Device-Aufrufen Matter-Zuordnungen aktualisiert.
 */
type Notify = (deviceId: string, methodName: string, values: unknown[]) => void;
let boundNotify: Notify | undefined;

export function setMatterSwitchTargetNotify(notify: Notify | undefined): void {
  boundNotify = notify;
}

export function notifyMatterSwitchTargetDeviceAction(deviceId: string, methodName: string, values: unknown[]): void {
  try {
    boundNotify?.(deviceId, methodName, values);
  } catch {
    /* kein harter Fehler, wenn Binding nicht initialisiert */
  }
}
