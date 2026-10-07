import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket
} from "mysql2/promise";
import { logger } from "../config/logger.js";
import { loadMySqlConfig, type MySqlConfig } from "./dbConfig.js";
import { runMigrations } from "./runMigrations.js";

export type SqlParam = string | number | boolean | Date | null;

/** Gemeinsame Schnittstelle für Pool und Transaktion, damit Repositories beides nutzen können. */
export interface SqlExecutor {
  query<T extends RowDataPacket>(sql: string, params?: SqlParam[]): Promise<T[]>;
  /** Führt INSERT/UPDATE/DELETE aus und liefert die Anzahl betroffener Zeilen. */
  execute(sql: string, params?: SqlParam[]): Promise<number>;
}

class MySqlExecutor implements SqlExecutor {
  constructor(private readonly target: Pool | PoolConnection) {}

  async query<T extends RowDataPacket>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    const [rows] = await this.target.execute<T[]>(sql, params);
    return rows;
  }

  async execute(sql: string, params: SqlParam[] = []): Promise<number> {
    const [result] = await this.target.execute<ResultSetHeader>(sql, params);
    return result.affectedRows;
  }
}

export class DatabaseManager implements SqlExecutor {
  private readonly config: MySqlConfig;
  private pool: Pool | null = null;
  private executor: MySqlExecutor | null = null;

  constructor(config: MySqlConfig = loadMySqlConfig()) {
    this.config = config;
  }

  async connect() {
    if (this.pool) {
      logger.debug("Datenbankverbindung bereits geöffnet");
      return;
    }

    logger.info(
      {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user
      },
      "Verbinde mit MySQL-Datenbank"
    );

    await this.createSchemaIfMissing();
    await runMigrations(this.config);

    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      charset: "utf8mb4",
      timezone: "Z",
      decimalNumbers: true,
      waitForConnections: true,
      connectionLimit: 10
    });
    this.executor = new MySqlExecutor(this.pool);

    logger.info("Datenbankverbindung erfolgreich hergestellt");
  }

  async query<T extends RowDataPacket>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    return this.getExecutor().query<T>(sql, params);
  }

  async execute(sql: string, params: SqlParam[] = []): Promise<number> {
    return this.getExecutor().execute(sql, params);
  }

  /** Führt `work` in einer Transaktion aus; bei einem Fehler wird alles zurückgerollt. */
  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const connection = await this.getPool().getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(new MySqlExecutor(connection));
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.executor = null;
      logger.info("Datenbankverbindung geschlossen");
    }
  }

  isConnected() {
    return this.pool !== null;
  }

  private getPool(): Pool {
    if (!this.pool) {
      throw new Error("Datenbank ist nicht verbunden");
    }
    return this.pool;
  }

  private getExecutor(): MySqlExecutor {
    if (!this.executor) {
      throw new Error("Datenbank ist nicht verbunden");
    }
    return this.executor;
  }

  private async createSchemaIfMissing() {
    const connection = await mysql.createConnection({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password
    });
    try {
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(this.config.database)}
           CHARACTER SET utf8mb4
           COLLATE utf8mb4_unicode_ci`
      );
    } finally {
      await connection.end();
    }
  }
}
