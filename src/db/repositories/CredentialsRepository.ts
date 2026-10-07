import type { RowDataPacket } from "mysql2/promise";
import { DbModuleCredential } from "../../model/db/DbModuleCredential.js";
import type { DatabaseManager } from "../database.js";
import { fromNullable, toStringParam } from "../sqlValues.js";

const SQL_SELECT_CREDENTIALS = `
  SELECT
      c.module_id     AS moduleId,
      c.id,
      c.username,
      c.password,
      c.server_url    AS serverUrl,
      c.captcha_token AS captchaToken
  FROM module_credentials AS c`;

const SQL_SELECT_CREDENTIALS_BY_MODULE = `${SQL_SELECT_CREDENTIALS}
  WHERE c.module_id = ?
  ORDER BY c.id`;

const SQL_SELECT_CREDENTIALS_BY_ID = `${SQL_SELECT_CREDENTIALS}
  WHERE c.module_id = ?
    AND c.id = ?`;

const SQL_UPSERT_CREDENTIALS = `
  INSERT INTO module_credentials (module_id, id, username, password, server_url, captcha_token)
  VALUES (?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      username      = incoming.username,
      password      = incoming.password,
      server_url    = incoming.server_url,
      captcha_token = incoming.captcha_token`;

const SQL_DELETE_CREDENTIALS = `
  DELETE FROM module_credentials
  WHERE module_id = ?
    AND id = ?`;

export type ModuleCredentials = {
  id: string;
  username?: string;
  password?: string;
  server?: string;
  captchaToken?: string;
};

/** Zugangsdaten eines Moduls; ein Modul kann mehrere Konten haben (z. B. Apple-Kalender). */
export class CredentialsRepository {
  constructor(
    private readonly db: DatabaseManager,
    private readonly moduleId: string
  ) {}

  async findAll(): Promise<ModuleCredentials[]> {
    const rows = await this.db.query<RowDataPacket>(SQL_SELECT_CREDENTIALS_BY_MODULE, [this.moduleId]);
    return rows.map(row => toCredentials(toDbModuleCredential(row)));
  }

  async findById(id: string): Promise<ModuleCredentials | null> {
    const [row] = await this.db.query<RowDataPacket>(SQL_SELECT_CREDENTIALS_BY_ID, [this.moduleId, id]);
    return row ? toCredentials(toDbModuleCredential(row)) : null;
  }

  async save(credentials: ModuleCredentials): Promise<void> {
    const dbCredential = new DbModuleCredential({
      moduleId: this.moduleId,
      id: credentials.id,
      username: toStringParam(credentials.username),
      password: toStringParam(credentials.password),
      serverUrl: toStringParam(credentials.server),
      captchaToken: toStringParam(credentials.captchaToken)
    });
    await this.db.execute(SQL_UPSERT_CREDENTIALS, [
      dbCredential.moduleId,
      dbCredential.id,
      dbCredential.username,
      dbCredential.password,
      dbCredential.serverUrl,
      dbCredential.captchaToken
    ]);
  }

  async deleteById(id: string): Promise<boolean> {
    return (await this.db.execute(SQL_DELETE_CREDENTIALS, [this.moduleId, id])) > 0;
  }
}

function toDbModuleCredential(row: RowDataPacket): DbModuleCredential {
  return new DbModuleCredential({
    moduleId: row.moduleId,
    id: row.id,
    username: row.username,
    password: row.password,
    serverUrl: row.serverUrl,
    captchaToken: row.captchaToken
  });
}

function toCredentials(dbCredential: DbModuleCredential): ModuleCredentials {
  return {
    id: dbCredential.id,
    username: fromNullable(dbCredential.username),
    password: fromNullable(dbCredential.password),
    server: fromNullable(dbCredential.serverUrl),
    captchaToken: fromNullable(dbCredential.captchaToken)
  };
}
