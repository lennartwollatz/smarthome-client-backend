import { fetch } from "undici";
import { logger } from "../../logger.js";
import type { DeviceCatalog } from "./types.js";
import { catalogToLlmJson } from "./deviceCatalog.js";
import type { LlmAutomationIdea } from "./types.js";

export type OllamaConfig = {
  baseUrl: string;
  model: string;
  enabled: boolean;
};

const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
  model: process.env.OLLAMA_MODEL ?? "phi3:mini",
  enabled: process.env.OLLAMA_ENABLED === "true",
};

/**
 * Optional: ruft ein lokales Ollama-LLM ab, um zusätzliche Automatisierungs-Ideen zu generieren.
 * Standardmäßig deaktiviert — Templates liefern bereits sinnvolle Vorschläge offline.
 */
export async function fetchLlmAutomationIdeas(
  catalog: DeviceCatalog,
  config: OllamaConfig = DEFAULT_CONFIG
): Promise<LlmAutomationIdea[]> {
  if (!config.enabled) return [];

  const prompt = `Du bist ein Smarthome-Assistent. Analysiere die Geräte und schlage 1-3 sinnvolle Automatisierungen vor.
Antworte NUR mit JSON-Array:
[{"name":"...","description":"...","patternType":"llm_...","confidence":0.0-1.0}]

Geräte:
${catalogToLlmJson(catalog)}`;

  try {
    const res = await fetch(`${config.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, prompt, stream: false, format: "json" }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Ollama-Anfrage fehlgeschlagen");
      return [];
    }
    const body = (await res.json()) as { response?: string };
    const parsed = JSON.parse(body.response ?? "[]") as LlmAutomationIdea[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.warn({ err }, "Ollama nicht erreichbar — LLM-Vorschläge übersprungen");
    return [];
  }
}
