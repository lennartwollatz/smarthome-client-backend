import type { ITokenStore, Token } from "bmw-connected-drive";
import { OAuthTokenRepository, type OAuthToken } from "../../db/repositories/OAuthTokenRepository.js";
import type { DatabaseManager } from "../../db/database.js";
import { logger } from "../../config/logger.js";
import { BMWCONFIG } from "./bmwModule.js";

export class BMWTokenStore implements ITokenStore {
  private repo: OAuthTokenRepository;
  private cache: OAuthToken | null = null;

  constructor(databaseManager: DatabaseManager) {
    this.repo = new OAuthTokenRepository(databaseManager, BMWCONFIG.id);
  }

  async hydrate(): Promise<void> {
    this.cache = await this.repo.find();
  }

  storeToken(token: Token): void {
    this.cache = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      validUntil: token.validUntil instanceof Date ? token.validUntil : new Date(),
      rawResponse: token.response
    };
    void this.repo.save(this.cache).catch(err => {
      logger.error({ err }, "BMW-OAuth-Token konnte nicht gespeichert werden");
    });
  }

  retrieveToken(): Token | undefined {
    const raw = this.cache;
    if (!raw?.accessToken || !raw.refreshToken) return undefined;
    return {
      response: raw.rawResponse ?? "",
      accessToken: raw.accessToken,
      refreshToken: raw.refreshToken,
      validUntil: raw.validUntil
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
    this.cache = null;
    void this.repo.delete().catch(err => {
      logger.error({ err }, "BMW-OAuth-Token konnte nicht gelöscht werden");
    });
  }
}
