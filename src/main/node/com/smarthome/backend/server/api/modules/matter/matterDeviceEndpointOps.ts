/**
 * Von {@link MatterVirtualDeviceManager} implementiert — MatterDeviceBoolBridge steuert
 * Endpunkte/Restarts ohne zirkuläre Abhängigkeit der Modul-Dateien.
 */
export interface IMatterDeviceEndpointOps {
  setVirtualMatterEndpointState(matterDeviceId: string, buttonId: string, on: boolean): Promise<boolean>;
  /** VA- oder Host-Server neu starten, wenn Endpunkt-Liste (Bool-Zuordnungen) geändert wurde. */
  restartVirtualMatterByDeviceId(matterDeviceId: string): Promise<void>;
}
