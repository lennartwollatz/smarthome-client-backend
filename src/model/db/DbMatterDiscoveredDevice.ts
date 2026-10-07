/** Zeile der Tabelle `matter_discovered_devices`. */
export class DbMatterDiscoveredDevice {
  readonly id!: string;
  readonly name!: string | null;
  readonly address!: string | null;
  readonly port!: number | null;
  readonly vendorId!: number | null;
  readonly productId!: number | null;
  readonly discriminator!: number | null;
  readonly deviceType!: number | null;
  readonly instanceName!: string | null;
  readonly pairingHint!: string | null;
  readonly pairingInstruction!: string | null;
  readonly rotatingId!: string | null;
  readonly isCommissionable!: boolean;
  readonly isOperational!: boolean;
  readonly lastSeenAt!: Date | null;
  readonly sessionIdleInterval!: number | null;
  readonly sessionActiveInterval!: number | null;
  readonly sessionActiveThreshold!: number | null;
  readonly tcpSupported!: boolean | null;
  readonly compressedFabricId!: string | null;
  readonly operationalNodeId!: string | null;
  readonly nodeId!: string | null;
  readonly nodeFabricId!: string | null;
  readonly token!: string | null;
  readonly pairedAt!: Date | null;
  readonly isPaired!: boolean;

  constructor(fields: DbMatterDiscoveredDevice) {
    Object.assign(this, fields);
  }
}
