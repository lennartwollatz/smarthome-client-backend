import type { ITokenStore, Token } from "bmw-connected-drive";
import { JsonRepository } from "../../../db/jsonRepository.js";
import type { DatabaseManager } from "../../../db/database.js";

const BMW_TOKEN_ID = "bmw-oauth-token";

type PersistedToken = {
  response?: string;
  accessToken?: string;
  refreshToken?: string;
  validUntil?: string; // ISO
};

export class BMWTokenStore implements ITokenStore {
  private repo: JsonRepository<PersistedToken>;

  constructor(databaseManager: DatabaseManager) {
    this.repo = new JsonRepository<PersistedToken>(databaseManager, "BMWOAuthToken");
  }

  storeToken(token: Token): void {
    this.repo.save(BMW_TOKEN_ID, {
      response: token.response,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      validUntil: token.validUntil?.toISOString?.() ?? new Date().toISOString()
    });
  }

  retrieveToken(): Token | undefined {
    const raw = this.repo.findById(BMW_TOKEN_ID);
    if (!raw?.accessToken || !raw.refreshToken || !raw.validUntil) return undefined;
    // Token-Klasse kommt aus bmw-connected-drive – wir erzeugen eine "Token"-ähnliche Struktur,
    // die die Lib akzeptiert (sie greift nur auf Properties zu).
    return {
      response: raw.response ?? "",
      accessToken: raw.accessToken,
      refreshToken: raw.refreshToken,
      validUntil: new Date(raw.validUntil)
    } as Token;
  }

  hasToken(): boolean {
    return Boolean(this.retrieveToken());
  }

  isTokenExpired(): boolean {
    const token = this.retrieveToken();
    if (!token?.validUntil) return true;
    return new Date() > new Date(token.validUntil);
  }

  hasValidToken(): boolean {
    return this.hasToken() && !this.isTokenExpired();
  }

  clear(): void {
    this.repo.save(BMW_TOKEN_ID, {});
  }
}


