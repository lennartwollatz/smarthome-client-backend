/**
 * Konfiguration: ein Matter-Endpunkt (On/Off) spiegelt/steuert ein Bool-Attribut eines beliebigen Geräts.
 * Persistenz: JsonRepository mit type "MatterDeviceBoolConfig", id = matterDeviceId
 */

export interface MatterDeviceBoolWriteSpec {
  /** Methodenname laut Prototyp des Quellgeräts (z. B. setPower, setPowerOn) */
  method: string;
  /**
   * Argumente wie im Workflow-Action-Node; invoke folgt derselben fn.length-Heuristik
   * wie in Action.invokeDeviceMethodInner.
   */
  values: unknown[];
}

/**
 * Eine logische Stelle: Matter slotId = Endpoint-ID; max. 32 Zeichen, [a-z0-9_-]
 */
export interface MatterDeviceBoolSlot {
  slotId: string;
  sourceDeviceId: string;
  /** Read: z. B. isPowerOn, isAppSelected */
  readFunction: string;
  readArgs?: unknown[];
  /**
   * Schreib-Methoden, wenn der Nutzer den Matter-Schalter in Home umschaltet (Matter → Gerät).
   * Wenn beide fehlen, versucht der Server anhand von readFunction Heuristiken
   * (z. B. isPowerOn → setPower, isScreenOn → setScreen; bei readArgs meist manuelle Angabe nötig).
   */
  writeOn?: MatterDeviceBoolWriteSpec;
  writeOff?: MatterDeviceBoolWriteSpec;
  /** Wenn ein Slot auf "an" geht, werden alle anderen derselben groupId in Matter (und optional Device) abgeschaltet. */
  groupId?: string;
  /** Anzeigename fürs Matter UserLabel (optional) */
  label?: string;
}

export interface MatterDeviceBoolConfig {
  matterDeviceId: string;
  slots: MatterDeviceBoolSlot[];
}

export const MATTER_BOOL_CONFIG_REPO_TYPE = "MatterDeviceBoolConfig";

export const RESERVED_MATTER_BUTTON_IDS = new Set(["onoff", "pause", "continue"]);
