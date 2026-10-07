/** Parameterwert aus dem Workflow-Editor; Lücken im Array kommen als `null` an. */
export type Request_ActionValue = string | number | boolean | null;

export type Request_ActionTriggerType = "manual" | "device" | "time" | "voice_assistant";

/** Position eines Knotens im Workflow-Editor. */
export class Request_ActionPosition {
  readonly x?: number | null;
  readonly y?: number | null;
}

/** Gerätebasierter Trigger; `triggerEvent` ist der Funktionsname des Geräts (z. B. "on"). */
export class Request_ActionDeviceTrigger {
  readonly triggerDeviceId?: string | null;
  readonly triggerModuleId?: string | null;
  readonly triggerEvent?: string | null;
  readonly triggerValues?: Request_ActionValue[] | null;
}

/** Zeitbasierter Trigger. */
export class Request_ActionTimeTrigger {
  readonly frequency?: "once" | "daily" | "weekly" | "monthly" | "yearly" | null;
  readonly time?: string | null;
  readonly weekdays?: number[] | null;
  readonly dayOfMonth?: number | null;
  readonly month?: number | null;
  readonly dayOfYear?: number | null;
}

/** Sprachassistent-Trigger. */
export class Request_ActionVoiceAssistantTrigger {
  readonly keyword?: string | null;
  readonly actionType?: string | null;
  readonly deviceId?: string | null;
  readonly pairingCode?: string | null;
}

/** Konfiguration eines Trigger-Knotens. */
export class Request_ActionTriggerConfig {
  readonly type!: Request_ActionTriggerType;
  readonly device?: Request_ActionDeviceTrigger | null;
  readonly time?: Request_ActionTimeTrigger | null;
  readonly voiceAssistant?: Request_ActionVoiceAssistantTrigger | null;
}

/** Konfiguration eines Aktions-Knotens. */
export class Request_ActionConfig {
  readonly type?: "device" | "scene" | "action" | null;
  readonly action?: string | null;
  readonly values?: Request_ActionValue[] | null;
  readonly deviceId?: string | null;
  readonly moduleId?: string | null;
  readonly sceneId?: string | null;
  readonly actionId?: string | null;
}

/** Konfiguration eines Bedingungs-Knotens bzw. einer while-Schleife. */
export class Request_ActionConditionConfig {
  readonly deviceId?: string | null;
  readonly moduleId?: string | null;
  readonly property?: string | null;
  readonly values?: Request_ActionValue[] | null;
}

/** Konfiguration eines Warte-Knotens. */
export class Request_ActionWaitConfig {
  readonly type?: "time" | "trigger" | null;
  readonly waitTime?: number | null;
  readonly deviceId?: string | null;
  readonly moduleId?: string | null;
  readonly triggerEvent?: string | null;
  readonly triggerValues?: Request_ActionValue[] | null;
  readonly timeout?: number | null;
}

/** Konfiguration eines Schleifen-Knotens. */
export class Request_ActionLoopConfig {
  readonly type?: "for" | "while" | null;
  readonly count?: number | null;
  readonly condition?: Request_ActionConditionConfig | null;
  readonly maxIterations?: number | null;
}

/** Knoten des Workflow-Graphen; Kanten sind Knoten-IDs. */
export class Request_ActionNode {
  readonly nodeId!: string;
  readonly type!: "trigger" | "action" | "condition" | "wait" | "loop";
  readonly order?: number | null;
  readonly name?: string | null;
  readonly position?: Request_ActionPosition | null;
  readonly triggerConfig?: Request_ActionTriggerConfig | null;
  readonly actionConfig?: Request_ActionConfig | null;
  readonly conditionConfig?: Request_ActionConditionConfig | null;
  readonly waitConfig?: Request_ActionWaitConfig | null;
  readonly loopConfig?: Request_ActionLoopConfig | null;
  readonly loopNodes?: string[] | null;
  readonly nextNodes?: string[] | null;
  readonly trueNodes?: string[] | null;
  readonly falseNodes?: string[] | null;
}

/** Workflow einer Aktion (POST/PUT /api/actions). */
export class Request_ActionWorkflow {
  readonly nodes!: Request_ActionNode[];
  readonly startNodeId?: string | null;
}
