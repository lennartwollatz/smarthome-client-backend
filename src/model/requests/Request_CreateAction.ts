import type { Request_ActionTriggerType, Request_ActionWorkflow } from "./Request_ActionWorkflow.js";

/** POST /api/actions */
export class Request_CreateAction {
  readonly actionId?: string | null;
  readonly name!: string;
  readonly triggerType!: Request_ActionTriggerType;
  readonly workflow!: Request_ActionWorkflow;
  readonly isActive?: boolean | null;
  readonly isAiSuggested?: boolean | null;
  readonly aiDescription?: string | null;
  readonly aiConfidence?: number | null;
  readonly aiPatternType?: string | null;
  readonly aiEvidenceCount?: number | null;
  readonly createdAt?: string | null;

  constructor(fields: Request_CreateAction) {
    Object.assign(this, fields);
  }
}
