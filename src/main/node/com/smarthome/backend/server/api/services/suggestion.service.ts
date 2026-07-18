import { Router } from "express";
import type { ServerDeps } from "../server.js";

export function createSuggestionRouter(deps: ServerDeps) {
  const router = Router();

  router.get("/status", (_req, res) => {
    if (!deps.suggestionService) {
      res.status(503).json({ error: "SuggestionService nicht verfügbar" });
      return;
    }
    res.status(200).json(deps.suggestionService.getStatus());
  });

  router.post("/analyze", async (req, res) => {
    if (!deps.routineAnalyzer) {
      res.status(503).json({ error: "RoutineAnalyzer nicht verfügbar" });
      return;
    }
    const includeLlm = Boolean((req.body as { includeLlm?: boolean })?.includeLlm);
    try {
      const result = await deps.routineAnalyzer.runOnce({ includeLlm });
      res.status(200).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.get("/catalog", (_req, res) => {
    if (!deps.suggestionService) {
      res.status(503).json({ error: "SuggestionService nicht verfügbar" });
      return;
    }
    res.status(200).json(
      deps.suggestionService.getDeviceCatalogPreview()
    );
  });

  return router;
}
