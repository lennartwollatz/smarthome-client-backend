import { randomUUID } from "node:crypto";
import { Action } from "../api/entities/actions/action/Action.js";
import type { ActionManager } from "../api/entities/actions/ActionManager.js";
import type { DeviceManager } from "../api/entities/devices/deviceManager.js";
import type { UserManager } from "../api/entities/users/userManager.js";
import type { SettingManager } from "../api/entities/settings/settingManager.js";
import { logger } from "../../logger.js";
import { buildDeviceCatalog } from "./deviceCatalog.js";
import { discoverTemplatePatterns } from "./automationTemplates.js";
import { validateSuggestedAction } from "./suggestionValidator.js";
import { PatternStore, hashPattern } from "./patternStore.js";
import { fetchLlmAutomationIdeas } from "./ollamaSuggestionProvider.js";
import type { AutomationPattern, SuggestionRunResult } from "./types.js";

export class SuggestionService {
  private patternStore: PatternStore;
  private lastRun: SuggestionRunResult | null = null;

  constructor(
    learningDbPath: string,
    private deviceManager: DeviceManager,
    private userManager: UserManager,
    private actionManager: ActionManager,
    private settingManager: SettingManager
  ) {
    this.patternStore = new PatternStore(learningDbPath);
  }

  getStatus(): { lastRun: SuggestionRunResult | null; lastStoredRun: ReturnType<PatternStore["getLastRun"]> } {
    return {
      lastRun: this.lastRun,
      lastStoredRun: this.patternStore.getLastRun(),
    };
  }

  getDeviceCatalogPreview() {
    return buildDeviceCatalog(this.deviceManager, this.userManager, this.actionManager);
  }

  /** Erzeugt AI-Vorschläge aus Gerätekatalog + Templates (+ optional LLM). */
  async runAnalysis(options?: { includeLlm?: boolean }): Promise<SuggestionRunResult> {
    const settings = this.settingManager.loadOrCreateSettings();
    const aiLearning = settings.privacy?.ailearning !== false;
    if (!aiLearning) {
      return {
        analyzedAt: new Date().toISOString(),
        patternsFound: 0,
        suggestionsCreated: 0,
        suggestionsSkipped: 0,
        errors: ["AI-Lernen ist deaktiviert (privacy.ailearning)"],
      };
    }

    const catalog = buildDeviceCatalog(this.deviceManager, this.userManager, this.actionManager);
    const patterns = discoverTemplatePatterns(catalog);
    const errors: string[] = [];
    let created = 0;
    let skipped = 0;

    if (options?.includeLlm) {
      const ideas = await fetchLlmAutomationIdeas(catalog);
      for (const idea of ideas) {
        patterns.push({
          patternId: `llm_${idea.patternType}`,
          patternType: idea.patternType,
          name: idea.name,
          description: idea.description,
          confidence: idea.confidence,
          evidenceCount: 0,
          category: "LLM",
          actionDrafts: [],
        });
      }
    }

    for (const pattern of patterns) {
      for (const draft of pattern.actionDrafts) {
        const patternHash = hashPattern(pattern.patternType, draft.name);
        if (this.patternStore.isPatternBlacklisted(patternHash)) {
          skipped += 1;
          continue;
        }
        if (this.hasExistingSuggestion(pattern.patternType, draft.name)) {
          skipped += 1;
          continue;
        }

        const action = this.buildSuggestedAction(pattern, draft.name, draft.triggerType, draft.workflow);
        const validation = validateSuggestedAction(action, this.deviceManager);
        if (!validation.valid) {
          errors.push(...validation.errors.map((e) => `${draft.name}: ${e}`));
          skipped += 1;
          continue;
        }

        const saved = this.actionManager.addAiSuggestion(action);
        if (saved) {
          created += 1;
          logger.info({ actionId: saved.actionId, name: saved.name, patternType: pattern.patternType }, "AI-Vorschlag erstellt");
        } else {
          skipped += 1;
        }
      }
    }

    this.patternStore.recordRun(patterns.length, created, skipped);
    this.lastRun = {
      analyzedAt: new Date().toISOString(),
      patternsFound: patterns.length,
      suggestionsCreated: created,
      suggestionsSkipped: skipped,
      errors,
    };
    return this.lastRun;
  }

  onSuggestionRejected(action: Action): void {
    const hash = hashPattern(action.aiPatternType ?? "unknown", action.name);
    this.patternStore.blacklistPattern(hash, action.aiPatternType ?? "", "user_rejected");
    this.patternStore.recordFeedback(action.actionId, action.aiPatternType, undefined, "rejected");
  }

  onSuggestionAccepted(action: Action): void {
    this.patternStore.recordFeedback(action.actionId, action.aiPatternType, undefined, "accepted");
  }

  private hasExistingSuggestion(patternType: string, name: string): boolean {
    return this.actionManager.getActions().some(
      (a) =>
        a.aiPatternType === patternType &&
        a.name === name &&
        (a.isAiSuggested || a.isActive)
    );
  }

  private buildSuggestedAction(
    pattern: AutomationPattern,
    actionName: string,
    triggerType: Action["triggerType"],
    workflow: Action["workflow"]
  ): Action {
    const now = new Date().toISOString();
    return new Action({
      actionId: `action-suggest-${randomUUID()}`,
      name: actionName,
      triggerType,
      workflow,
      isActive: false,
      isAiSuggested: true,
      category: pattern.category,
      aiDescription: pattern.description,
      aiConfidence: pattern.confidence,
      aiPatternType: pattern.patternType,
      aiEvidenceCount: pattern.evidenceCount,
      createdAt: now,
      updatedAt: now,
    });
  }
}
