import { EventType } from "../../../../events/event-types/EventType.js";

export type VoiceAssistantCommandAction = "an" | "aus" | "start" | "stop" | "pause" | "fortsetzen";

export class VoiceAssistantTrigger {
  keyword?: string;
  actionType?: VoiceAssistantCommandAction;
  triggerEvent?: EventType;
  deviceId?: string;
  matterNodeId?: string;
  port?: number;
  passcode?: number;
  discriminator?: number;
  buttonId?: string;
  pairingCode?: string;
  qrPairingCode?: string;

  constructor(init?: Partial<VoiceAssistantTrigger>) {
    Object.assign(this, init);
  }
}
