export class PairingRequest {
  pairingCode?: string;

  constructor(init?: Partial<PairingRequest>) {
    Object.assign(this, init);
  }
}
