/**
 * Von {@link MatterVirtualDeviceManager} implementiert — MatterDeviceBoolBridge steuert
 * Endpunkte/Restarts ohne zirkuläre Abhängigkeit der Modul-Dateien.
 */
export interface IMatterDeviceEndpointOps {
  setVirtualMatterEndpointState(matterDeviceId: string, buttonId: string, on: boolean): Promise<boolean>;
  /**
   * VA- oder Host-Server neu starten, nötig wenn sich die Menge der Matter-Endpunkt-IDs
   * (slotId-Liste) geändert hat — nicht bei bloßer Anpassung von read/Quellgerät.
   */
  restartVirtualMatterByDeviceId(matterDeviceId: string): Promise<void>;
}
