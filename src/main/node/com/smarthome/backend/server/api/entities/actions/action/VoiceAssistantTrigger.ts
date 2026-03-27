import { EventType } from "../../../../events/event-types/EventType.js";
import { VoiceAssistantCommandAction } from "../../../modules/matter/voiceAssistantCommandMapping.js";

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
