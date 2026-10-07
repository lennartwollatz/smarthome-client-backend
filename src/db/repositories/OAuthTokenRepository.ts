import type { RowDataPacket } from "mysql2/promise";
import { DbModuleOAuthToken } from "../../model/db/DbModuleOAuthToken.js";
import type { DatabaseManager } from "../database.js";
import { fromNullable, toStringParam } from "../sqlValues.js";

const SQL_SELECT_TOKEN = `
  SELECT
      t.module_id     AS moduleId,
      t.access_token  AS accessToken,
      t.refresh_token AS refreshToken,
      t.valid_until   AS validUntil,
      t.raw_response  AS rawResponse
  FROM module_oauth_tokens AS t
  WHERE t.module_id = ?`;

const SQL_UPSERT_TOKEN = `
  INSERT INTO module_oauth_tokens (module_id, access_token, refresh_token, valid_until, raw_response)
  VALUES (?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      access_token  = incoming.access_token,
      refresh_token = incoming.refresh_token,
      valid_until   = incoming.valid_until,
      raw_response  = incoming.raw_response`;

const SQL_DELETE_TOKEN = `
  DELETE FROM module_oauth_tokens
  WHERE module_id = ?`;

export type OAuthToken = {
  accessToken: string;
  refreshToken: string;
  validUntil: Date;
  rawResponse?: string;
};

/** Ein OAuth-Token je Modul. */
export class OAuthTokenRepository {
  constructor(
    private readonly db: DatabaseManager,
    private readonly moduleId: string
  ) {}

  async find(): Promise<OAuthToken | null> {
    const [row] = await this.db.query<RowDataPacket>(SQL_SELECT_TOKEN, [this.moduleId]);
    return row ? toToken(toDbModuleOAuthToken(row)) : null;
  }

  async save(token: OAuthToken): Promise<void> {
    const dbToken = new DbModuleOAuthToken({
      moduleId: this.moduleId,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      validUntil: token.validUntil,
      rawResponse: toStringParam(token.rawResponse)
    });
    await this.db.execute(SQL_UPSERT_TOKEN, [
      dbToken.moduleId,
      dbToken.accessToken,
      dbToken.refreshToken,
      dbToken.validUntil,
      dbToken.rawResponse
    ]);
  }

  async delete(): Promise<void> {
    await this.db.execute(SQL_DELETE_TOKEN, [this.moduleId]);
  }
}

function toDbModuleOAuthToken(row: RowDataPacket): DbModuleOAuthToken {
  return new DbModuleOAuthToken({
    moduleId: row.moduleId,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    validUntil: row.validUntil,
    rawResponse: row.rawResponse
  });
}

function toToken(dbToken: DbModuleOAuthToken): OAuthToken {
  return {
    accessToken: dbToken.accessToken,
    refreshToken: dbToken.refreshToken,
    validUntil: dbToken.validUntil,
    rawResponse: fromNullable(dbToken.rawResponse)
  };
}
