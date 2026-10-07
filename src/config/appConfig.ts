export type VersionConfig = {
  current: string;
  latest: string;
};

export type AppConfig = {
  port: number;
  apiToken: string;
  hcaptchaSiteKey: string;
  frontendVersion: VersionConfig;
  backendVersion: VersionConfig;
};

const DEFAULT_PORT = 4040;
const DEFAULT_VERSION = "1.0.0";

let cachedConfig: AppConfig | undefined;

/** Liest die Anwendungskonfiguration einmalig aus der Umgebung (.env). */
export function getAppConfig(): AppConfig {
  cachedConfig ??= loadAppConfig();
  return cachedConfig;
}

function loadAppConfig(): AppConfig {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT muss eine positive Ganzzahl sein");
  }

  return {
    port,
    apiToken: requiredEnv("API_TOKEN"),
    hcaptchaSiteKey: process.env.HCAPTCHA_SITE_KEY?.trim() ?? "",
    frontendVersion: {
      current: optionalEnv("FRONTEND_VERSION_CURRENT", DEFAULT_VERSION),
      latest: optionalEnv("FRONTEND_VERSION_LATEST", DEFAULT_VERSION)
    },
    backendVersion: {
      current: optionalEnv("BACKEND_VERSION_CURRENT", DEFAULT_VERSION),
      latest: optionalEnv("BACKEND_VERSION_LATEST", DEFAULT_VERSION)
    }
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Umgebungsvariable ${name} ist nicht gesetzt`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name]?.trim() || defaultValue;
}
