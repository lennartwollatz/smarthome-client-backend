import { Router } from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type PublicConfig = {
  hcaptchaSiteKey: string;
};

function loadConfiguration(): Record<string, string> {
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

function getHcaptchaSiteKey(config: Record<string, string>): string {
  return (
    process.env.HCAPTCHA_SITE_KEY ??
    process.env.hcaptchaSiteKey ??
    config["hcaptchaSiteKey"] ??
    ""
  );
}

export function createConfigRouter() {
  const router = Router();

  router.get("/public", (_req, res) => {
    const config = loadConfiguration();
    const publicConfig: PublicConfig = {
      hcaptchaSiteKey: getHcaptchaSiteKey(config)
    };
    res.status(200).json(publicConfig);
  });

  return router;
}
