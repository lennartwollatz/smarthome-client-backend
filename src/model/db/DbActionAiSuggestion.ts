/** Zeile der Tabelle `action_ai_suggestions`. */
export class DbActionAiSuggestion {
  readonly actionId!: string;
  readonly description!: string | null;
  readonly confidence!: number | null;
  readonly patternType!: string | null;
  readonly evidenceCount!: number | null;

  constructor(fields: DbActionAiSuggestion) {
    Object.assign(this, fields);
  }
}
