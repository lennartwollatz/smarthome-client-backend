/**
 * Gemeinsame Energie-Typen (keine Abhängigkeit zum Server), damit Ports/Archive
 * {@link DeviceSwitch} nicht zyklisch importieren müssen.
 */
export interface EnergyUsage {
  time: number;
  value: number;
}

export interface Energy {
  now: number;
  tt: number;
  wt: number;
  mt: number;
  yt: number;
}
