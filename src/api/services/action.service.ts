import { randomUUID } from "node:crypto";
import type { ActionManager } from "../../actions/ActionManager.js";
import { Action } from "../../actions/action/Action.js";
import { ActionConfig } from "../../actions/action/ActionConfig.js";
import { ConditionConfig } from "../../actions/action/ConditionConfig.js";
import { DeviceTrigger } from "../../actions/action/DeviceTrigger.js";
import { LoopConfig } from "../../actions/action/LoopConfig.js";
import { Node } from "../../actions/action/Node.js";
import { Position } from "../../actions/action/Position.js";
import { TimeTrigger } from "../../actions/action/TimeTrigger.js";
import { TriggerConfig } from "../../actions/action/TriggerConfig.js";
import { VoiceAssistantTrigger } from "../../actions/action/VoiceAssistantTrigger.js";
import { WaitConfig } from "../../actions/action/WaitConfig.js";
import { Workflow } from "../../actions/action/Workflow.js";
import type { EventParameter } from "../../events/event-types/EventParameter.js";
import type { EventType } from "../../events/event-types/EventType.js";
import type { Request_ActivateAction } from "../../model/requests/Request_ActivateAction.js";
import type {
  Request_ActionConditionConfig,
  Request_ActionConfig,
  Request_ActionDeviceTrigger,
  Request_ActionLoopConfig,
  Request_ActionNode,
  Request_ActionPosition,
  Request_ActionTimeTrigger,
  Request_ActionTriggerConfig,
  Request_ActionValue,
  Request_ActionVoiceAssistantTrigger,
  Request_ActionWaitConfig,
  Request_ActionWorkflow
} from "../../model/requests/Request_ActionWorkflow.js";
import type { Request_CreateAction } from "../../model/requests/Request_CreateAction.js";
import type { Request_CreateActionVoiceAssistant } from "../../model/requests/Request_CreateActionVoiceAssistant.js";
import type { Request_DeactivateAction } from "../../model/requests/Request_DeactivateAction.js";
import type { Request_DeleteAction } from "../../model/requests/Request_DeleteAction.js";
import type { Request_DeleteActionVoiceAssistant } from "../../model/requests/Request_DeleteActionVoiceAssistant.js";
import type { Request_GetAction } from "../../model/requests/Request_GetAction.js";
import type { Request_GetActions } from "../../model/requests/Request_GetActions.js";
import type { Request_RejectAiSuggestion } from "../../model/requests/Request_RejectAiSuggestion.js";
import type { Request_UpdateAction } from "../../model/requests/Request_UpdateAction.js";
import type { MatterVoiceAssistantManager } from "../../modules/voiceassistant/MatterVoiceAssistantManager.js";
import { Response_ActivateAction } from "../../model/responses/Response_ActivateAction.js";
import { Response_CreateAction } from "../../model/responses/Response_CreateAction.js";
import { Response_CreateActionVoiceAssistant } from "../../model/responses/Response_CreateActionVoiceAssistant.js";
import { Response_DeactivateAction } from "../../model/responses/Response_DeactivateAction.js";
import { Response_DeleteAction } from "../../model/responses/Response_DeleteAction.js";
import { Response_DeleteActionVoiceAssistant } from "../../model/responses/Response_DeleteActionVoiceAssistant.js";
import { Response_GetAction } from "../../model/responses/Response_GetAction.js";
import { Response_GetActions } from "../../model/responses/Response_GetActions.js";
import { Response_RejectAiSuggestion } from "../../model/responses/Response_RejectAiSuggestion.js";
import { Response_UpdateAction } from "../../model/responses/Response_UpdateAction.js";
import { ApiError } from "../http/ApiError.js";

const ACTION_NOT_FOUND = "Action not found";

type ActionFields = Omit<Request_CreateAction, "actionId" | "createdAt">;

export class ActionService {
  constructor(
    private readonly actionManager: ActionManager,
    private readonly voiceAssistantManager: MatterVoiceAssistantManager
  ) {}

  async createVoiceAssistant(
    request: Request_CreateActionVoiceAssistant
  ): Promise<Response_CreateActionVoiceAssistant> {
    try {
      const device = await this.voiceAssistantManager.createVoiceAssistantDevice(request.actionId, request.keyword);
      return new Response_CreateActionVoiceAssistant(device.deviceId, device.pairingCode);
    } catch {
      throw ApiError.internal("Fehler beim Erstellen des Voice-Assistant-Device");
    }
  }

  async deleteVoiceAssistant(
    request: Request_DeleteActionVoiceAssistant
  ): Promise<Response_DeleteActionVoiceAssistant> {
    try {
      await this.voiceAssistantManager.removeVoiceAssistantDevice(request.actionId);
    } catch {
      throw ApiError.internal("Fehler beim Loeschen des Voice-Assistant-Device");
    }
    return new Response_DeleteActionVoiceAssistant();
  }

  getActions(_request: Request_GetActions): Response_GetActions {
    return new Response_GetActions(this.actionManager.getActions());
  }

  getAction(request: Request_GetAction): Response_GetAction {
    const action = this.actionManager.getAction(request.actionId);
    if (!action) throw ApiError.notFound(ACTION_NOT_FOUND);
    return new Response_GetAction(action);
  }

  createAction(request: Request_CreateAction): Response_CreateAction {
    const now = new Date().toISOString();
    const action = toAction(request, request.actionId || `action-${randomUUID()}`, request.createdAt || now, now);

    if (!this.actionManager.addAction(action)) {
      throw ApiError.badRequest(`Action not created: ${action.actionId}`);
    }
    return new Response_CreateAction(action);
  }

  updateAction(request: Request_UpdateAction): Response_UpdateAction {
    const action = toAction(request, request.actionId, request.createdAt ?? undefined, new Date().toISOString());

    if (!this.actionManager.updateAction(action)) {
      throw ApiError.badRequest(`Action not created: ${action.actionId}`);
    }
    return new Response_UpdateAction(action);
  }

  deleteAction(request: Request_DeleteAction): Response_DeleteAction {
    if (!this.actionManager.deleteAction(request.actionId)) {
      throw ApiError.notFound(ACTION_NOT_FOUND);
    }
    return new Response_DeleteAction();
  }

  activateAction(request: Request_ActivateAction): Response_ActivateAction {
    const action = this.actionManager.activateAction(request.actionId);
    if (!action) throw ApiError.notFound(ACTION_NOT_FOUND);
    return new Response_ActivateAction(action);
  }

  deactivateAction(request: Request_DeactivateAction): Response_DeactivateAction {
    const action = this.actionManager.deactivateAction(request.actionId);
    if (!action) throw ApiError.notFound(ACTION_NOT_FOUND);
    return new Response_DeactivateAction(action);
  }

  rejectAiSuggestion(request: Request_RejectAiSuggestion): Response_RejectAiSuggestion {
    if (!this.actionManager.rejectAiSuggestion(request.actionId)) {
      throw ApiError.badRequest("Action not found or not an AI suggestion");
    }
    return new Response_RejectAiSuggestion();
  }
}

function toAction(fields: ActionFields, actionId: string, createdAt: string | undefined, updatedAt: string): Action {
  return new Action({
    actionId,
    name: fields.name,
    triggerType: fields.triggerType,
    workflow: toWorkflow(fields.workflow),
    isActive: fields.isActive ?? true,
    isAiSuggested: fields.isAiSuggested ?? false,
    aiDescription: fields.aiDescription ?? undefined,
    aiConfidence: fields.aiConfidence ?? undefined,
    aiPatternType: fields.aiPatternType ?? undefined,
    aiEvidenceCount: fields.aiEvidenceCount ?? undefined,
    createdAt,
    updatedAt
  });
}

function toWorkflow(workflow: Request_ActionWorkflow): Workflow {
  return new Workflow({
    nodes: workflow.nodes.map(toNode),
    startNodeId: workflow.startNodeId ?? undefined
  });
}

function toNode(node: Request_ActionNode): Node {
  return new Node({
    nodeId: node.nodeId,
    type: node.type,
    order: node.order ?? undefined,
    name: node.name ?? undefined,
    position: node.position ? toPosition(node.position) : undefined,
    triggerConfig: node.triggerConfig ? toTriggerConfig(node.triggerConfig) : undefined,
    actionConfig: node.actionConfig ? toActionConfig(node.actionConfig) : undefined,
    conditionConfig: node.conditionConfig ? toConditionConfig(node.conditionConfig) : undefined,
    waitConfig: node.waitConfig ? toWaitConfig(node.waitConfig) : undefined,
    loopConfig: node.loopConfig ? toLoopConfig(node.loopConfig) : undefined,
    loopNodes: node.loopNodes ?? undefined,
    nextNodes: node.nextNodes ?? undefined,
    trueNodes: node.trueNodes ?? undefined,
    falseNodes: node.falseNodes ?? undefined
  });
}

function toPosition(position: Request_ActionPosition): Position {
  return new Position({
    x: position.x ?? undefined,
    y: position.y ?? undefined
  });
}

function toTriggerConfig(config: Request_ActionTriggerConfig): TriggerConfig {
  return new TriggerConfig({
    type: config.type,
    device: config.device ? toDeviceTrigger(config.device) : undefined,
    time: config.time ? toTimeTrigger(config.time) : undefined,
    voiceAssistant: config.voiceAssistant ? toVoiceAssistantTrigger(config.voiceAssistant) : undefined
  });
}

function toDeviceTrigger(trigger: Request_ActionDeviceTrigger): DeviceTrigger {
  return new DeviceTrigger({
    triggerDeviceId: trigger.triggerDeviceId ?? undefined,
    triggerModuleId: trigger.triggerModuleId ?? undefined,
    triggerEvent: toEventType(trigger.triggerEvent),
    triggerValues: toEventParameters(trigger.triggerValues)
  });
}

function toTimeTrigger(trigger: Request_ActionTimeTrigger): TimeTrigger {
  return new TimeTrigger({
    frequency: trigger.frequency ?? undefined,
    time: trigger.time ?? undefined,
    weekdays: trigger.weekdays ?? undefined,
    dayOfMonth: trigger.dayOfMonth ?? undefined,
    month: trigger.month ?? undefined,
    dayOfYear: trigger.dayOfYear ?? undefined
  });
}

function toVoiceAssistantTrigger(trigger: Request_ActionVoiceAssistantTrigger): VoiceAssistantTrigger {
  return new VoiceAssistantTrigger({
    keyword: trigger.keyword ?? undefined,
    actionType: trigger.actionType ?? undefined,
    deviceId: trigger.deviceId ?? undefined,
    pairingCode: trigger.pairingCode ?? undefined
  });
}

function toActionConfig(config: Request_ActionConfig): ActionConfig {
  return new ActionConfig({
    type: config.type ?? undefined,
    action: config.action ?? undefined,
    values: config.values ?? undefined,
    deviceId: config.deviceId ?? undefined,
    moduleId: config.moduleId ?? undefined,
    sceneId: config.sceneId ?? undefined,
    actionId: config.actionId ?? undefined
  });
}

function toConditionConfig(config: Request_ActionConditionConfig): ConditionConfig {
  return new ConditionConfig({
    deviceId: config.deviceId ?? undefined,
    moduleId: config.moduleId ?? undefined,
    property: config.property ?? undefined,
    // Der Domänentyp `Object[]` schließt die `null`-Lücken aus dem Editor nicht ein.
    values: (config.values ?? undefined) as Object[] | undefined
  });
}

function toWaitConfig(config: Request_ActionWaitConfig): WaitConfig {
  return new WaitConfig({
    type: config.type ?? undefined,
    waitTime: config.waitTime ?? undefined,
    deviceId: config.deviceId ?? undefined,
    moduleId: config.moduleId ?? undefined,
    triggerEvent: toEventType(config.triggerEvent),
    triggerValues: toEventParameters(config.triggerValues),
    timeout: config.timeout ?? undefined
  });
}

function toLoopConfig(config: Request_ActionLoopConfig): LoopConfig {
  return new LoopConfig({
    type: config.type ?? undefined,
    count: config.count ?? undefined,
    condition: config.condition ? toConditionConfig(config.condition) : undefined,
    maxIterations: config.maxIterations ?? undefined
  });
}

/** Das Frontend sendet Gerätefunktionsnamen (z. B. "on"), die nicht im Enum `EventType` liegen müssen. */
function toEventType(triggerEvent: string | null | undefined): EventType | undefined {
  return (triggerEvent ?? undefined) as EventType | undefined;
}

/** Das Frontend sendet Rohwerte statt `EventParameter`-Objekten; der Domänentyp bildet das nicht ab. */
function toEventParameters(values: Request_ActionValue[] | null | undefined): EventParameter[] | undefined {
  return (values ?? undefined) as unknown as EventParameter[] | undefined;
}
