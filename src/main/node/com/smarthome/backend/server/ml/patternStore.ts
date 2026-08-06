import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { logger } from "../../logger.js";

type DB = InstanceType<typeof Database>;

export type PatternFeedbackType = "counter_action" | "manual_override" | "rejected" | "accepted";

export class PatternStore {
  private db: DB;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (dir && dir !== "." && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pattern_blacklist (
        pattern_hash TEXT PRIMARY KEY,
        pattern_type TEXT,
        reason       TEXT,
        ts           INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS routine_feedback (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        action_id    TEXT NOT NULL,
        pattern_type TEXT,
        device_id    TEXT,
        feedback_type TEXT NOT NULL,
        ts           INTEGER NOT NULL,
        context      TEXT
      );
      CREATE TABLE IF NOT EXISTS suggestion_runs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        ts           INTEGER NOT NULL,
        patterns_found INTEGER NOT NULL,
        suggestions_created INTEGER NOT NULL,
        suggestions_skipped INTEGER NOT NULL
      );
    `);
  }

  isPatternBlacklisted(patternHash: string): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM pattern_blacklist WHERE pattern_hash = ?")
      .get(patternHash);
    return !!row;
  }

  blacklistPattern(patternHash: string, patternType: string, reason: string): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO pattern_blacklist (pattern_hash, pattern_type, reason, ts) VALUES (?, ?, ?, ?)"
      )
      .run(patternHash, patternType, reason, Date.now());
  }

  recordFeedback(
    actionId: string,
    patternType: string | undefined,
    deviceId: string | undefined,
    feedbackType: PatternFeedbackType,
    context?: Record<string, unknown>
  ): void {
    this.db
      .prepare(
        "INSERT INTO routine_feedback (action_id, pattern_type, device_id, feedback_type, ts, context) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(
        actionId,
        patternType ?? null,
        deviceId ?? null,
        feedbackType,
        Date.now(),
        context ? JSON.stringify(context) : null
      );
  }

  recordRun(patternsFound: number, created: number, skipped: number): void {
    this.db
      .prepare(
        "INSERT INTO suggestion_runs (ts, patterns_found, suggestions_created, suggestions_skipped) VALUES (?, ?, ?, ?)"
      )
      .run(Date.now(), patternsFound, created, skipped);
  }

  getLastRun(): { ts: number; patternsFound: number; suggestionsCreated: number; suggestionsSkipped: number } | null {
    const row = this.db
      .prepare(
        "SELECT ts, patterns_found AS patternsFound, suggestions_created AS suggestionsCreated, suggestions_skipped AS suggestionsSkipped FROM suggestion_runs ORDER BY id DESC LIMIT 1"
      )
      .get() as
      | { ts: number; patternsFound: number; suggestionsCreated: number; suggestionsSkipped: number }
      | undefined;
    return row ?? null;
  }

  close(): void {
    this.db.close();
  }
}

export function hashPattern(patternType: string, actionName: string): string {
  return `${patternType}::${actionName}`.toLowerCase();
}
