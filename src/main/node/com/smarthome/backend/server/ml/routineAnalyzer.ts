import { logger } from "../../logger.js";
import type { SuggestionService } from "./suggestionService.js";

const ANALYZE_INTERVAL_MS = Number(process.env.SUGGESTION_INTERVAL_MS ?? 24 * 60 * 60 * 1000);

/** Periodische Analyse — schwere Arbeit außerhalb des Event-Pfads. */
export class RoutineAnalyzer {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(private suggestionService: SuggestionService) {}

  startPeriodic(): void {
    if (this.timer) return;
    const run = () => {
      void this.runOnce().catch((err) => logger.error({ err }, "Routine-Analyse fehlgeschlagen"));
    };
    setTimeout(run, 60_000);
    this.timer = setInterval(run, ANALYZE_INTERVAL_MS);
    logger.info({ intervalMs: ANALYZE_INTERVAL_MS }, "RoutineAnalyzer: periodische Analyse gestartet");
  }

  stopPeriodic(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async runOnce(options?: { includeLlm?: boolean }) {
    if (this.running) {
      logger.warn("Routine-Analyse läuft bereits — übersprungen");
      return null;
    }
    this.running = true;
    try {
      logger.info("Routine-Analyse gestartet");
      return await this.suggestionService.runAnalysis(options);
    } finally {
      this.running = false;
    }
  }
}
