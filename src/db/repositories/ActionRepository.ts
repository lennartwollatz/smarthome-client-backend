import type { RowDataPacket } from "mysql2/promise";
import type { Action, TriggerType } from "../../actions/action/Action.js";
import type { Workflow } from "../../actions/action/Workflow.js";
import type { DatabaseManager, SqlExecutor } from "../database.js";
import {
  fromNullable,
  toBoolean,
  toDateParam,
  toNumberParam,
  toStringParam
} from "../sqlValues.js";
import { loadWorkflows, saveWorkflow } from "./actions/actionWorkflowTables.js";

const SQL_SELECT_ACTIONS = `
  SELECT
      a.id,
      a.name,
      a.trigger_type,
      a.is_active,
      a.created_at,
      a.updated_at,
      ai.action_id      IS NOT NULL AS is_ai_suggested,
      ai.description    AS ai_description,
      ai.confidence     AS ai_confidence,
      ai.pattern_type   AS ai_pattern_type,
      ai.evidence_count AS ai_evidence_count
  FROM actions AS a
  LEFT JOIN action_ai_suggestions AS ai
      ON ai.action_id = a.id`;

const SQL_SELECT_ALL_ACTIONS = `${SQL_SELECT_ACTIONS}
  ORDER BY a.created_at`;

const SQL_UPSERT_ACTION = `
  INSERT INTO actions (id, name, trigger_type, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      name         = incoming.name,
      trigger_type = incoming.trigger_type,
      is_active    = incoming.is_active,
      updated_at   = incoming.updated_at`;

const SQL_UPSERT_AI_SUGGESTION = `
  INSERT INTO action_ai_suggestions (action_id, description, confidence, pattern_type, evidence_count)
  VALUES (?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      description    = incoming.description,
      confidence     = incoming.confidence,
      pattern_type   = incoming.pattern_type,
      evidence_count = incoming.evidence_count`;

const SQL_DELETE_AI_SUGGESTION = `
  DELETE FROM action_ai_suggestions
  WHERE action_id = ?`;

const SQL_DELETE_ACTION = `
  DELETE FROM actions
  WHERE id = ?`;

type ActionRow = RowDataPacket & {
  id: string;
  name: string;
  trigger_type: TriggerType;
  is_active: number;
  created_at: Date;
  updated_at: Date;
  is_ai_suggested: number;
  ai_description: string | null;
  ai_confidence: number | null;
  ai_pattern_type: string | null;
  ai_evidence_count: number | null;
};

/** Liefert Aktionsdaten; der ActionManager erzeugt daraus `Action`-Instanzen. */
export class ActionRepository {
  constructor(private readonly db: DatabaseManager) {}

  async findAll(): Promise<Partial<Action>[]> {
    const rows = await this.db.query<ActionRow>(SQL_SELECT_ALL_ACTIONS);
    const workflows = await loadWorkflows(
      this.db,
      rows.map(row => row.id)
    );
    return rows.map(row => toActionData(row, workflows.get(row.id)));
  }

  async save(action: Action): Promise<void> {
    await this.db.transaction(async tx => {
      await tx.execute(SQL_UPSERT_ACTION, [
        action.actionId,
        action.name,
        action.triggerType,
        action.isActive !== false,
        toDateParam(action.createdAt),
        toDateParam(action.updatedAt)
      ]);
      await saveWorkflow(tx, action.actionId, action.workflow);
      await saveAiSuggestion(tx, action);
    });
  }

  async deleteById(actionId: string): Promise<boolean> {
    return (await this.db.execute(SQL_DELETE_ACTION, [actionId])) > 0;
  }
}

async function saveAiSuggestion(tx: SqlExecutor, action: Action): Promise<void> {
  if (!action.isAiSuggested) {
    await tx.execute(SQL_DELETE_AI_SUGGESTION, [action.actionId]);
    return;
  }
  await tx.execute(SQL_UPSERT_AI_SUGGESTION, [
    action.actionId,
    toStringParam(action.aiDescription),
    toNumberParam(action.aiConfidence),
    toStringParam(action.aiPatternType),
    toNumberParam(action.aiEvidenceCount)
  ]);
}

function toActionData(row: ActionRow, workflow: Workflow | undefined): Partial<Action> {
  return {
    actionId: row.id,
    name: row.name,
    triggerType: row.trigger_type,
    isActive: toBoolean(row.is_active),
    workflow,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    isAiSuggested: toBoolean(row.is_ai_suggested),
    aiDescription: fromNullable(row.ai_description),
    aiConfidence: fromNullable(row.ai_confidence),
    aiPatternType: fromNullable(row.ai_pattern_type),
    aiEvidenceCount: fromNullable(row.ai_evidence_count)
  };
}
