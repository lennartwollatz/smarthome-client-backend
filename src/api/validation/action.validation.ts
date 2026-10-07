import { z } from "zod";

const KEYWORD_ERROR = "Keyword muss ein einzelnes Wort sein";

const actionIdParams = z.object({
  actionId: z.string().min(1)
});

const voiceAssistantBody = z.object({
  keyword: z
    .string({ error: KEYWORD_ERROR })
    .trim()
    .min(1, KEYWORD_ERROR)
    .refine(keyword => !keyword.includes(" "), KEYWORD_ERROR)
});

const triggerType = z.enum(["manual", "device", "time", "voice_assistant"]);

/** Lücken in Parameter-Arrays des Workflow-Editors kommen als `null` an. */
const actionValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const position = z.object({
  x: z.number().nullish(),
  y: z.number().nullish()
});

const deviceTrigger = z.object({
  triggerDeviceId: z.string().nullish(),
  triggerModuleId: z.string().nullish(),
  triggerEvent: z.string().nullish(),
  triggerValues: z.array(actionValue).nullish()
});

const timeTrigger = z.object({
  frequency: z.enum(["once", "daily", "weekly", "monthly", "yearly"]).nullish(),
  time: z.string().nullish(),
  weekdays: z.array(z.number().int().min(0).max(6)).nullish(),
  dayOfMonth: z.number().nullish(),
  month: z.number().nullish(),
  dayOfYear: z.number().nullish()
});

const voiceAssistantTrigger = z.object({
  keyword: z.string().nullish(),
  actionType: z.string().nullish(),
  deviceId: z.string().nullish(),
  pairingCode: z.string().nullish()
});

const triggerConfig = z.object({
  type: triggerType,
  device: deviceTrigger.nullish(),
  time: timeTrigger.nullish(),
  voiceAssistant: voiceAssistantTrigger.nullish()
});

const actionConfig = z.object({
  type: z.enum(["device", "scene", "action"]).nullish(),
  action: z.string().nullish(),
  values: z.array(actionValue).nullish(),
  deviceId: z.string().nullish(),
  moduleId: z.string().nullish(),
  sceneId: z.string().nullish(),
  actionId: z.string().nullish()
});

const conditionConfig = z.object({
  deviceId: z.string().nullish(),
  moduleId: z.string().nullish(),
  property: z.string().nullish(),
  values: z.array(actionValue).nullish()
});

const waitConfig = z.object({
  type: z.enum(["time", "trigger"]).nullish(),
  waitTime: z.number().nullish(),
  deviceId: z.string().nullish(),
  moduleId: z.string().nullish(),
  triggerEvent: z.string().nullish(),
  triggerValues: z.array(actionValue).nullish(),
  timeout: z.number().nullish()
});

const loopConfig = z.object({
  type: z.enum(["for", "while"]).nullish(),
  count: z.number().nullish(),
  condition: conditionConfig.nullish(),
  maxIterations: z.number().nullish()
});

const node = z.object({
  nodeId: z.string(),
  type: z.enum(["trigger", "action", "condition", "wait", "loop"]),
  order: z.number().nullish(),
  name: z.string().nullish(),
  position: position.nullish(),
  triggerConfig: triggerConfig.nullish(),
  actionConfig: actionConfig.nullish(),
  conditionConfig: conditionConfig.nullish(),
  waitConfig: waitConfig.nullish(),
  loopConfig: loopConfig.nullish(),
  loopNodes: z.array(z.string()).nullish(),
  nextNodes: z.array(z.string()).nullish(),
  trueNodes: z.array(z.string()).nullish(),
  falseNodes: z.array(z.string()).nullish()
});

const workflow = z.object({
  nodes: z.array(node),
  startNodeId: z.string().nullish()
});

const actionBody = z.object({
  actionId: z.string().nullish(),
  name: z.string(),
  triggerType,
  workflow,
  isActive: z.boolean().nullish(),
  isAiSuggested: z.boolean().nullish(),
  aiDescription: z.string().nullish(),
  aiConfidence: z.number().nullish(),
  aiPatternType: z.string().nullish(),
  aiEvidenceCount: z.number().nullish(),
  createdAt: z.string().nullish()
});

export const actionValidation = {
  createVoiceAssistant: z.object({ params: actionIdParams, body: voiceAssistantBody }),
  deleteVoiceAssistant: z.object({ params: actionIdParams }),
  getActions: z.object({}),
  createAction: z.object({ body: actionBody }),
  getAction: z.object({ params: actionIdParams }),
  updateAction: z.object({ params: actionIdParams, body: actionBody.omit({ actionId: true }) }),
  deleteAction: z.object({ params: actionIdParams }),
  activateAction: z.object({ params: actionIdParams }),
  deactivateAction: z.object({ params: actionIdParams }),
  rejectAiSuggestion: z.object({ params: actionIdParams })
};
