import { EventType } from "../../../events/event-types/EventType.js";

export const VA_MATTER_BTN_ONOFF = "onoff";
export const VA_MATTER_BTN_PAUSE = "pause";
export const VA_MATTER_BTN_CONTINUE = "continue";


export type VoiceAssistantCommandAction = "an" | "aus" | "start" | "stop" | "pause" | "fortsetzen";

export function voiceAssistantActionToButtonId(actionType: VoiceAssistantCommandAction | undefined): string {
  if (actionType === "an") return VA_MATTER_BTN_ONOFF;
  if (actionType === "aus") return VA_MATTER_BTN_ONOFF;
  if (actionType === "start") return VA_MATTER_BTN_ONOFF;
  if (actionType === "stop") return VA_MATTER_BTN_ONOFF;
  if (actionType === "pause") return VA_MATTER_BTN_PAUSE;
  if (actionType === "fortsetzen") return VA_MATTER_BTN_CONTINUE;
  return VA_MATTER_BTN_ONOFF;
}

export function voiceAssistantActionToButtonIds(actionType: VoiceAssistantCommandAction | undefined): string[] {
  if (actionType === "an") return [VA_MATTER_BTN_ONOFF];
  if (actionType === "aus") return [VA_MATTER_BTN_ONOFF];
  if (actionType === "start") return [VA_MATTER_BTN_ONOFF, VA_MATTER_BTN_PAUSE, VA_MATTER_BTN_CONTINUE];
  if (actionType === "stop") return [VA_MATTER_BTN_ONOFF, VA_MATTER_BTN_PAUSE, VA_MATTER_BTN_CONTINUE];
  if (actionType === "pause") return [VA_MATTER_BTN_ONOFF, VA_MATTER_BTN_PAUSE, VA_MATTER_BTN_CONTINUE];
  if (actionType === "fortsetzen") return [VA_MATTER_BTN_ONOFF, VA_MATTER_BTN_PAUSE, VA_MATTER_BTN_CONTINUE];
  return [VA_MATTER_BTN_ONOFF];
}

export function voiceAssistantActionToEventId(actionType: VoiceAssistantCommandAction | undefined): EventType {
  if (actionType === "an") return EventType.SWITCH_BUTTON_ON;
  if (actionType === "aus") return EventType.SWITCH_BUTTON_OFF;
  if (actionType === "start") return EventType.SWITCH_BUTTON_ON;
  if (actionType === "stop") return EventType.SWITCH_BUTTON_OFF;
  if (actionType === "pause") return EventType.SWITCH_BUTTON_ON;
  if (actionType === "fortsetzen") return EventType.SWITCH_BUTTON_ON ;
  return EventType.SWITCH_BUTTON_ON;
}
