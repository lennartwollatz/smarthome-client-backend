/** Zeile der Tabelle `waclighting_discovered_devices`. */
export class DbWacLightingDiscoveredDevice {
  readonly id!: string;
  readonly name!: string | null;
  readonly address!: string | null;
  readonly port!: number | null;
  readonly mac!: string | null;
  readonly model!: string | null;
  readonly manufacturer!: string | null;
  readonly clientId!: string | null;
  readonly fanInstalled!: boolean | null;
  readonly lightInstalled!: boolean | null;
  readonly hasFan!: boolean | null;
  readonly hasLight!: boolean | null;
  readonly firmwareVersion!: string | null;
  readonly productType!: string | null;

  constructor(fields: DbWacLightingDiscoveredDevice) {
    Object.assign(this, fields);
  }
}
