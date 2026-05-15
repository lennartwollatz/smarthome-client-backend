import { JsonRepository } from "../../../db/jsonRepository.js";
import type { DatabaseManager } from "../../../db/database.js";
import { refreshCarDataTokens } from "./bmwCarDataOAuth.js";
import { logger } from "../../../../logger.js";

const BMW_TOKEN_ID = "bmw-cardata-token";

export type CarDataPersistedToken = {
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  gcid?: string;
  grantedScope?: string;
  accessExpiresAt?: string;
  idExpiresAt?: string;
  refreshExpiresAt?: string;
};

function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return undefined;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function decodeJwtExpMs(idToken: string): number | undefined {
  const payload = decodeJwtPayload(idToken);
  if (payload && typeof payload.exp === "number") return payload.exp * 1000;
  return undefined;
}

function extractGcidFromTokenClaims(claims: Record<string, unknown> | undefined): string | undefined {
  if (!claims) return undefined;
  for (const key of ["gcid", "GCID", "sub"]) {
    const v = claims[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

export class BMWTokenStore {
  private repo: JsonRepository<CarDataPersistedToken>;

  constructor(databaseManager: DatabaseManager) {
    this.repo = new JsonRepository<CarDataPersistedToken>(databaseManager, "BMWOAuthToken");
  }

  /**
   * Speichert Token aus Device-Code- oder Refresh-Antwort (POST …/gcdm/oauth/token).
   * Refresh liefert oft kein `gcid` – bestehende Werte bleiben erhalten.
   */
  storeFromOAuthBody(body: Record<string, unknown>): void {
    const prev = this.getPersisted();

    const accessToken =
      body.access_token != null && String(body.access_token).length > 0
        ? String(body.access_token)
        : (prev.accessToken ?? "");
    const refreshToken =
      body.refresh_token != null && String(body.refresh_token).length > 0
        ? String(body.refresh_token)
        : (prev.refreshToken ?? "");
    const idToken =
      body.id_token != null && String(body.id_token).length > 0
        ? String(body.id_token)
        : (prev.idToken ?? "");

    let gcid = typeof body.gcid === "string" && body.gcid.trim() ? body.gcid.trim() : undefined;
    if (!gcid && idToken) {
      gcid = extractGcidFromTokenClaims(decodeJwtPayload(idToken));
    }
    if (!gcid) gcid = prev.gcid;

    const grantedScope =
      typeof body.scope === "string" && body.scope.trim()
        ? body.scope
        : prev.grantedScope;

    const now = Date.now();
    const expiresIn =
      body.expires_in != null && Number.isFinite(Number(body.expires_in))
        ? Number(body.expires_in)
        : undefined;
    const accessExpiresAt =
      expiresIn != null
        ? new Date(now + expiresIn * 1000).toISOString()
        : (prev.accessExpiresAt ?? new Date(now + 3600 * 1000).toISOString());

    const idExpMs = idToken ? decodeJwtExpMs(idToken) : undefined;
    const idExpiresAt = new Date(
      idExpMs ?? (expiresIn != null ? now + expiresIn * 1000 : Date.parse(prev.idExpiresAt ?? "") || now + 3600 * 1000)
    ).toISOString();

    const refreshExpiresIn =
      body.refresh_expires_in != null && Number.isFinite(Number(body.refresh_expires_in))
        ? Number(body.refresh_expires_in)
        : undefined;
    const refreshExpiresAt =
      refreshExpiresIn != null
        ? new Date(now + refreshExpiresIn * 1000).toISOString()
        : prev.refreshExpiresAt;

    this.repo.save(BMW_TOKEN_ID, {
      accessToken,
      refreshToken,
      idToken,
      gcid,
      grantedScope,
      accessExpiresAt,
      idExpiresAt,
      refreshExpiresAt
    });
  }

  isAccessTokenExpired(bufferMs = 120_000): boolean {
    const raw = this.getPersisted();
    if (!raw.accessExpiresAt) return !raw.accessToken;
    return Date.now() > new Date(raw.accessExpiresAt).getTime() - bufferMs;
  }

  /** Access- oder ID-Token (MQTT-Passwort) laufen bald ab. */
  needsTokenRefresh(bufferMs = 120_000): boolean {
    return this.isAccessTokenExpired(bufferMs) || this.isIdTokenExpired(bufferMs);
  }

  /**
   * Holt neue Token per Refresh-Token (grant_type=refresh_token, client_id, refresh_token).
   */
  async refreshWithStoredToken(clientId: string): Promise<boolean> {
    const prev = this.getPersisted();
    if (!prev.refreshToken) return false;
    if (this.isRefreshExpired()) {
      logger.warn("BMW Refresh-Token abgelaufen – erneute Anmeldung erforderlich");
      return false;
    }
    try {
      const body = await refreshCarDataTokens(clientId, prev.refreshToken);
      this.storeFromOAuthBody(body);
      return true;
    } catch (err) {
      logger.error({ err }, "BMW Token Refresh fehlgeschlagen");
      return false;
    }
  }

  getPersisted(): CarDataPersistedToken {
    return this.repo.findById(BMW_TOKEN_ID) ?? {};
  }

  getCarDataTokens(): { accessToken: string; refreshToken: string; idToken: string; gcid: string } | null {
    const raw = this.getPersisted();
    if (!raw.accessToken || !raw.refreshToken || !raw.idToken || !raw.gcid) return null;
    return {
      accessToken: raw.accessToken,
      refreshToken: raw.refreshToken,
      idToken: raw.idToken,
      gcid: raw.gcid
    };
  }

  hasRefreshToken(): boolean {
    return Boolean(this.getPersisted().refreshToken);
  }

  isRefreshExpired(): boolean {
    const raw = this.getPersisted();
    if (!raw.refreshExpiresAt) return !raw.refreshToken;
    return Date.now() > new Date(raw.refreshExpiresAt).getTime();
  }

  /** ID-Token (MQTT-Passwort) nahezu abgelaufen */
  isIdTokenExpired(bufferMs = 90_000): boolean {
    const raw = this.getPersisted();
    if (!raw.idExpiresAt) return true;
    return Date.now() > new Date(raw.idExpiresAt).getTime() - bufferMs;
  }

  clear(): void {
    this.repo.save(BMW_TOKEN_ID, {});
  }

  private decodeJwtPayload(idToken: string): Record<string, unknown> | undefined {
    return decodeJwtPayload(idToken);
  }

  private extractScopesFromClaims(claims: Record<string, unknown> | undefined): string[] {
    if (!claims) return [];

    const rawScope =
      typeof claims["scope"] === "string"
        ? claims["scope"]
        : typeof claims["scp"] === "string"
          ? claims["scp"]
          : typeof claims["scopes"] === "string"
            ? claims["scopes"]
            : undefined;

    if (!rawScope) return [];
    return rawScope.split(/\s+/).map(s => s.trim()).filter(Boolean);
  }

  /**
   * Strikte Pruefung, ob der ID-Token den erforderlichen Scope enthaelt.
   * Bei unbekanntem Claim/Format wird false zurueckgegeben.
   */
  hasIdTokenScope(requiredScope: string): boolean {
    const { idToken } = this.getPersisted();
    if (!idToken) return false;
    const claims = this.decodeJwtPayload(idToken);
    const scopes = this.extractScopesFromClaims(claims);
    return scopes.includes(requiredScope);
  }

  getGrantedScope(): string | null {
    const s = this.getPersisted().grantedScope;
    return s && s.length > 0 ? s : null;
  }

  getGcid(): string | null {
    const g = this.getPersisted().gcid;
    return g && g.length > 0 ? g : null;
  }

  /** MQTT-Subscribe laut Id-Streaming: {gcid}/+ (Username = GCID, nicht OAuth-Client-ID). */
  getMqttSubscribeTopic(): string | null {
    const gcid = this.getGcid();
    return gcid ? `${gcid}/+` : null;
  }

  /**
   * Diagnose: BMW traegt Streaming-Rechte oft in dynamic_scopes im ID-Token (nicht in scope/scp).
   */
  hasDynamicStreamingScopes(): boolean {
    const { idToken } = this.getPersisted();
    if (!idToken) return false;
    const claims = this.decodeJwtPayload(idToken);
    if (!claims) return false;
    const dyn = claims["dynamic_scopes"] ?? claims["dynamicScopes"];
    if (typeof dyn === "string") return dyn.trim().length > 0;
    if (Array.isArray(dyn)) return dyn.length > 0;
    return false;
  }
}
