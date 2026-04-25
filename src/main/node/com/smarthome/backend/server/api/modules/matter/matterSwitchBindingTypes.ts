/**
 * Eine Matter-Virtual-Switch (VA oder Host) ist einem Ziel-Device zugeordnet;
 * true-/false-Action mappen On/Off bidirektional.
 */
export type MatterActionSpec = {
  functionName: string;
  /** Wie Workflow-Node: rohe Werte (nach Normalisierung aus ParameterValue) */
  values: unknown[];
};

export type MatterSwitchTargetBinding = {
  matterDeviceId: string;
  targetDeviceId: string;
  trueAction: MatterActionSpec;
  falseAction: MatterActionSpec;
  /**
   * Optional: `functionsTrigger`-Namen des Zielgeräts (Frontend). Bei Auslösung wird
   * der Matter-Endpoint per {@link setMatterEndpointProgrammatically} gesetzt — ohne
   * erneute Ziel-Aktion.
   */
  trueTriggerEvent?: string;
  falseTriggerEvent?: string;
};
