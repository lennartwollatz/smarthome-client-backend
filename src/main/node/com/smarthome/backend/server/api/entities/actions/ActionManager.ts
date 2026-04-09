import { Action } from "./action/Action.js";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import { EventManager } from "../../../events/EventManager.js";
import type { LiveUpdateService } from "../../services/live.service.js";
import { DeviceManager } from "../devices/deviceManager.js";
import { SceneManager } from "../scenes/sceneManager.js";
import { FloorplanManager } from "../floorplan/floorplanManager.js";
import { SettingManager } from "../settings/settingManager.js";
import { UserManager } from "../users/userManager.js";
import { EntityManager } from "../EntityManager.js";
import { MatterModuleManager } from "../../modules/matter/matterModuleManager.js";
import { VoiceAssistantTrigger } from "./action/VoiceAssistantTrigger.js";
import { VoiceAssistantCommandAction } from "../../modules/matter/voiceAssistantCommandMapping.js";
import type { ActionRunnableResponse } from "./runnable/ActionRunnableResponse.js";


export class ActionManager implements EntityManager {
  private actionRepository: JsonRepository<Action>;
  private liveUpdateService?: LiveUpdateService;
  private matterModuleManager?: MatterModuleManager;
  private actions = new Map<string, Action>();
  

  constructor(databaseManager: DatabaseManager, private eventManager: EventManager, private floorplanManager: FloorplanManager, private settingManager: SettingManager, private sceneManager: SceneManager, private deviceManager: DeviceManager, private userManager: UserManager) {
    this.actionRepository = new JsonRepository<Action>(databaseManager, "Action");
    this.initialize();
  }

  initialize() {
    this.loadActionsFromDatabase();
    this.setupWorkflows();
  }

  setLiveUpdateService(service: LiveUpdateService): void {
    this.liveUpdateService = service;
  }

  setMatterModuleManager(moduleManager: MatterModuleManager): void {
    this.matterModuleManager = moduleManager;
  }
 
  private loadActionsFromDatabase() {
    const actionDataList = this.actionRepository.findAll();
    actionDataList.forEach(actionData => {
      if (actionData?.actionId) {
        const action = new Action(actionData);
        this.actions.set(action.actionId, action);
      }
    });
  }

  private setupWorkflows() {
    const devices = this.deviceManager.getDevicesMap();
    const scenes = this.sceneManager.getScenesMap();
    this.actions.forEach(action => {
      if (!action.actionId) return;
      if (action.isActive === false) return;
      action.initActionRunnable(devices, scenes, this.eventManager);
    });
  }

  getActions(): Action[] {
    return Array.from(this.actions.values());
  }

  getAction(actionId: string): Action | null {
    return this.actions.get(actionId) ?? null;
  }

  addAction(action: Action): Action | null {
    if (!action?.actionId) return null;
    if (this.actions.has(action.actionId)) {
      return this.updateAction(action);
    }
    const instance = new Action(action);
    console.log(instance);
    if(instance.triggerType === "voice_assistant") {
      this.createVoiceAssistantForAction(instance, instance.getVoiceAssistantTriggerKeyword(), instance.getVoiceAssistantTriggerActionType(), instance.getVoiceAssistantTriggerDeviceId() ?? undefined);
    }
    this.actionRepository.save(instance.actionId, instance);
    this.actions.set(instance.actionId, instance);
    const devices = this.deviceManager.getDevicesMap();
    const scenes = this.sceneManager.getScenesMap();
    instance.initActionRunnable(devices, scenes, this.eventManager);
    this.liveUpdateService?.emit("action:updated", instance);
    return instance;
  }

  updateAction(instanceRaw: Action): Action | null {
    const instance = new Action(instanceRaw);
    const action = this.actions.get(instance.actionId);
    if (!action) return null;
    this.eventManager.removeListenerForAction(action.actionId);
    if( instance.triggerType !== "voice_assistant" ) {
      this.removeVoiceAssistantDevice(action.actionId, action.getVoiceAssistantTriggerDeviceId() ?? "");
    } else if( action.triggerType === "voice_assistant" && instance.triggerType === "voice_assistant" && action.getVoiceAssistantTriggerDeviceId() !== instance.getVoiceAssistantTriggerDeviceId()) {
      this.removeVoiceAssistantDevice(action.actionId, action.getVoiceAssistantTriggerDeviceId() ?? "");
      this.createVoiceAssistantForAction(instance, instance.getVoiceAssistantTriggerKeyword(), instance.getVoiceAssistantTriggerActionType(), instance.getVoiceAssistantTriggerDeviceId() ?? undefined);
    }
    this.actionRepository.save(instance.actionId, instance);
    this.actions.set(instance.actionId, instance);
    const devices = this.deviceManager.getDevicesMap();
    const scenes = this.sceneManager.getScenesMap();
    instance.initActionRunnable(devices, scenes, this.eventManager);
    this.liveUpdateService?.emit("action:updated", instance);
    return instance;
  }

  deleteAction(actionId: string): boolean {
    if (!this.actions.has(actionId)) return false;
    const action = this.actions.get(actionId);
    this.actions.delete(actionId);
    this.eventManager.removeListenerForAction(actionId);
    this.actionRepository.deleteById(actionId);
    this.sceneManager.removeActionIdFromAllScenes(actionId);
    this.liveUpdateService?.emit("action:removed", { actionId });
    this.removeVoiceAssistantDevice(actionId, action?.getVoiceAssistantTriggerDeviceId() ?? "");
    return true;
  }

  private async removeVoiceAssistantDevice(actionId: string, deviceId: string): Promise<boolean> {
    let isUsed = false;
    this.actions.forEach(action => {
      if (action.getVoiceAssistantTriggerDeviceId() === deviceId && action.actionId !== actionId) {
        isUsed = true;
        return;
      }
    });
    if (isUsed) return true;
    return await this.matterModuleManager?.removeVoiceAssistantDevice(deviceId) ?? false;
  }

  activateAction(actionId: string): Action | null {
    const action = this.actions.get(actionId);
    if (!action) return null;
    action.isActive = true;
    this.actionRepository.save(actionId, action);
    const devices = this.deviceManager.getDevicesMap();
    const scenes = this.sceneManager.getScenesMap();
    action.initActionRunnable(devices, scenes, this.eventManager);
    this.liveUpdateService?.emit("action:updated", action);
    return action;
  }

  deactivateAction(actionId: string): Action | null {
    const action = this.actions.get(actionId);
    if (!action) return null;
    action.isActive = false;
    this.eventManager.removeListenerForAction(actionId);
    this.actionRepository.save(actionId, action);
    this.liveUpdateService?.emit("action:updated", action);
    return action;
  }

  rejectAiSuggestion(actionId: string): boolean {
    const action = this.actions.get(actionId);
    if (!action || !action.isAiSuggested) return false;
    return this.deleteAction(actionId);
  }

  /**
   * Führt eine Aktion sofort aus (Workflow ab Startknoten), unabhängig vom Trigger-Typ.
   */
  runActionIgnoringTrigger(actionId: string): Promise<ActionRunnableResponse> {
    const action = this.actions.get(actionId);
    if (!action) {
      return Promise.resolve({
        success: false,
        error: "Action not found",
        environment: { environment: new Map() }
      });
    }
    const devices = this.deviceManager.getDevicesMap();
    const scenes = this.sceneManager.getScenesMap();
    return action.runWorkflowIgnoringTrigger(devices, scenes, this.eventManager);
  }

  acceptAiSuggestion(actionId: string): Action | null {
    const action = this.actions.get(actionId);
    if (!action || !action.isAiSuggested) return null;
    return this.activateAction(actionId);
  }

  async createVoiceAssistantForActionId(actionId: string, trimmed: string, actionType: VoiceAssistantCommandAction | undefined, deviceId: string | undefined) : Promise<VoiceAssistantTrigger | null> {
    const action = this.getAction(actionId);
    if (!action) return null;
    const voiceAssistantTrigger = await this.createVoiceAssistantForAction(action, trimmed, actionType, deviceId);
    if (!voiceAssistantTrigger) return null;
    this.actionRepository.save(action.actionId, action);
    this.actions.set(action.actionId, action);
    const devices = this.deviceManager.getDevicesMap();
    const scenes = this.sceneManager.getScenesMap();
    action.initActionRunnable(devices, scenes, this.eventManager);
    this.liveUpdateService?.emit("action:updated", action);
    return voiceAssistantTrigger;
  }

  async createVoiceAssistantForAction(action: Action, trimmed: string, actionType: VoiceAssistantCommandAction | undefined, deviceId: string | undefined) : Promise<VoiceAssistantTrigger | null> {
    const result = await this.matterModuleManager?.createVoiceAssistantDevice(trimmed, actionType, deviceId);
    if (!result) return null;
    const voiceAssistantTrigger = new VoiceAssistantTrigger({
      deviceId: result.deviceId,
      keyword: trimmed,
      actionType: actionType,
      matterNodeId: result.matterNodeId,
      port: result.port,
      passcode: result.passcode,
      discriminator: result.discriminator,
      buttonId: result.buttonId,
      pairingCode: result.pairingCode,
      qrPairingCode: result.qrPairingCode,
    });
    action.setVoiceAssistantTriggerData(voiceAssistantTrigger);

    return voiceAssistantTrigger;
  }
}
