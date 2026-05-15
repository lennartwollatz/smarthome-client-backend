export type ActionExecutionStatus = "running" | "completed" | "failed";

export type ActionExecutionTrigger =
  | "manual"
  | "device"
  | "time"
  | "voice_assistant"
  | "run_now"
  | "scene"
  | "nested";

export type ActionExecutionStepStatus = "running" | "completed" | "skipped" | "failed";

export type ActionExecutionInvocationKind =
  | "device"
  | "room"
  | "nested_action"
  | "condition_branch"
  | "wait"
  | "variable";

/** Ausgewerteter Vergleich einer Condition (für Anzeige im Frontend). */
export interface ActionExecutionConditionComparison {
  source: "device" | "variable" | "time";
  operator?: string;
  left?: unknown;
  right?: unknown;
  leftDescription?: string;
  rightDescription?: string;
}

/** Ziel einer Geräte-, Raum- oder Sub-Action-Ausführung. */
export interface ActionExecutionInvocationTarget {
  deviceId?: string;
  deviceName?: string;
  method?: string;
  actionId?: string;
  actionName?: string;
  roomId?: string;
  roomCategory?: string;
  roomCommand?: string;
}

export interface ActionExecutionInvocation {
  kind: ActionExecutionInvocationKind;
  label: string;
  args?: unknown[];
  result?: unknown;
  error?: string;
  nestedExecutionId?: string;
  comparison?: ActionExecutionConditionComparison;
  target?: ActionExecutionInvocationTarget;
}

export interface ActionExecutionStep {
  stepIndex: number;
  nodeId?: string;
  nodeName?: string;
  nodeType: string;
  executionMode: "sequential" | "parallel";
  parallelGroupId?: string;
  startedAt: string;
  finishedAt?: string;
  status: ActionExecutionStepStatus;
  invocations?: ActionExecutionInvocation[];
  warning?: string;
  error?: string;
}

export interface ActionExecution {
  executionId: string;
  actionId: string;
  actionName: string;
  trigger: ActionExecutionTrigger;
  status: ActionExecutionStatus;
  startedAt: string;
  finishedAt?: string;
  success?: boolean;
  error?: string;
  warning?: string;
  parentExecutionId?: string;
  steps: ActionExecutionStep[];
}
