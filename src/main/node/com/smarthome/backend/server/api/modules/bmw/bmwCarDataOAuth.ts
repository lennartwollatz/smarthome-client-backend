import { createHash, randomBytes } from "node:crypto";
import {
  BMW_CARDATA_DEVICE_CODE_URL,
  BMW_CARDATA_SCOPE,
  BMW_CARDATA_TOKEN_URL
} from "./bmwCarDataDefaults.js";

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64UrlEncode(randomBytes(32));
  const codeChallenge = base64UrlEncode(createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export type DeviceCodeStartResponse = {
  user_code: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  device_code: string;
  interval: number;
  expires_in: number;
};

export type TokenPollSuccess = {
  ok: true;
  body: Record<string, unknown>;
};

export type TokenPollPending = {
  ok: false;
  pending: true;
  slowDownExtraSec?: number;
};

export type TokenPollDenied = {
  ok: false;
  denied: true;
  error: string;
  error_description?: string;
};

export type TokenPollResult = TokenPollSuccess | TokenPollPending | TokenPollDenied;

function parseJsonSafe(text: string): Record<string, unknown> {
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function requestDeviceCode(
  clientId: string,
  codeChallenge: string
): Promise<DeviceCodeStartResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    response_type: "device_code",
    scope: BMW_CARDATA_SCOPE,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });
  const res = await fetch(BMW_CARDATA_DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const text = await res.text();
  const json = parseJsonSafe(text);
  if (!res.ok) {
    const err = String(json.error ?? res.status);
    const desc = json.error_description != null ? String(json.error_description) : text.slice(0, 200);
    throw new Error(`BMW Device Code Anfrage fehlgeschlagen: ${err} ${desc}`);
  }
  const device_code = String(json.device_code ?? "");
  if (!device_code) {
    throw new Error("BMW Device Code Antwort ohne device_code");
  }
  return {
    user_code: String(json.user_code ?? ""),
    verification_uri: json.verification_uri != null ? String(json.verification_uri) : undefined,
    verification_uri_complete:
      json.verification_uri_complete != null ? String(json.verification_uri_complete) : undefined,
    device_code,
    interval: typeof json.interval === "number" ? json.interval : 5,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : 900
  };
}

export async function pollDeviceToken(
  clientId: string,
  deviceCode: string,
  codeVerifier: string
): Promise<TokenPollResult> {
  const body = new URLSearchParams({
    client_id: clientId,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    code_verifier: codeVerifier
  });
  const res = await fetch(BMW_CARDATA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const text = await res.text();
  const json = parseJsonSafe(text);

  if (res.ok) {
    return { ok: true, body: json };
  }

  const err = String(json.error ?? "unknown_error");

  if (err === "authorization_pending") {
    return { ok: false, pending: true };
  }
  if (err === "slow_down") {
    return { ok: false, pending: true, slowDownExtraSec: 5 };
  }
  if (err === "access_denied" || err === "expired_token") {
    return {
      ok: false,
      denied: true,
      error: err,
      error_description: json.error_description != null ? String(json.error_description) : undefined
    };
  }

  return {
    ok: false,
    denied: true,
    error: err,
    error_description: json.error_description != null ? String(json.error_description) : text.slice(0, 300)
  };
}

/**
 * Erneuert Access-/ID-Token nach Ablauf (wie curl gegen BMW_CARDATA_TOKEN_URL).
 *
 * curl --request POST --url https://customer.bmwgroup.com/gcdm/oauth/token \\
 *   --header 'Content-Type: application/x-www-form-urlencoded' \\
 *   --data grant_type=refresh_token \\
 *   --data refresh_token=… \\
 *   --data client_id=…
 */
export async function refreshCarDataTokens(
  clientId: string,
  refreshToken: string
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId
  });
  const res = await fetch(BMW_CARDATA_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const text = await res.text();
  const json = parseJsonSafe(text);
  if (!res.ok) {
    throw new Error(
      `BMW Token Refresh fehlgeschlagen: ${json.error ?? res.status} ${json.error_description ?? text.slice(0, 200)}`
    );
  }
  return json;
}
