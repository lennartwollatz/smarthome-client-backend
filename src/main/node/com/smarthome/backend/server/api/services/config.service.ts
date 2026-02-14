import { Router } from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type PublicConfig = {
  hcaptchaSiteKey: string;
  // legacy / backwards compatibility
  recaptchaSiteKey?: string;
};

function loadConfiguration(): Record<string, string> {
  // Konvention wie in settings.service.ts: Node läuft typischerweise in src/main/node
  const configPath = resolve(process.cwd(), "..", "resources", "application.properties");
  try {
    const content = readFileSync(configPath, "utf8");
    const result: Record<string, string> = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function createConfigRouter() {
  const router = Router();
  const config = loadConfiguration();

  router.get("/public", (_req, res) => {
    const hcaptchaSiteKey =
      process.env.hcaptchaSiteKey ??
      process.env.HCAPTCHA_SITE_KEY ??
      config.hcaptchaSiteKey ??
      // fallback: previously used key name
      config.recaptchaSiteKey ??
      "";

    const payload: PublicConfig = {
      hcaptchaSiteKey: String(hcaptchaSiteKey ?? ""),
      recaptchaSiteKey: config.recaptchaSiteKey
    };

    res.status(200).json(payload);
  });

  return router;
}


