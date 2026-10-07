export class VoiceAssistantTrigger {
  keyword?: string;
  actionType?: string;
  deviceId?: string;
  pairingCode?: string;

  constructor(init?: Partial<VoiceAssistantTrigger>) {
    Object.assign(this, init);
  }
}
