import type { DatabaseManager } from "./database.js";
import type { Repository } from "./repository.js";
import { logger } from "../../logger.js";

export class JsonRepository<T> implements Repository<T> {
  private db: DatabaseManager;
  private typeName: string;

  constructor(db: DatabaseManager, typeName: string) {
    this.db = db;
    this.typeName = typeName;
  }

  save(id: string, object: T): T {
    logger.info({ type: this.typeName, id }, ">>> SPEICHERE");
    const json = JSON.stringify(object);
    const jsonSize = json.length;
    const dataPreview = json.length > 200 ? `${json.slice(0, 200)}...` : json;
    const sql = `
      INSERT INTO objects (id, type, data, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(id, type) DO UPDATE SET
        data = excluded.data,
        updated_at = datetime('now')
    `;
    const conn = this.db.createNewConnection();
    try {
      conn.prepare(sql).run(id, this.typeName, json);
      logger.info(
        {
          type: this.typeName,
          id,
          sizeBytes: jsonSize,
          dataPreview: dataPreview.replace(/\s+/g, " ")
        },
        ">>> GESPEICHERT"
      );
      return object;
    } catch (error) {
      logger.error({ error }, "Fehler beim Speichern des Objekts {} mit ID {}", this.typeName, id);
      throw new Error("Fehler beim Speichern in der Datenbank");
    } finally {
      conn.close();
    }
  }

  findById(id: string): T | null {
    logger.info({ type: this.typeName, id }, "<<< LESE");
    const sql = "SELECT data FROM objects WHERE id = ? AND type = ?";
    const conn = this.db.createNewConnection();
    try {
      const row = conn.prepare(sql).get(id, this.typeName) as { data: string } | undefined;
      if (!row) {
        logger.info({ type: this.typeName, id }, "<<< NICHT GEFUNDEN");
        return null;
      }
      const json = row.data;
      const jsonSize = json.length;
      const dataPreview = json.length > 200 ? `${json.slice(0, 200)}...` : json;
      logger.info(
        {
          type: this.typeName,
          id,
          sizeBytes: jsonSize,
          dataPreview: dataPreview.replace(/\s+/g, " ")
        },
        "<<< GEFUNDEN"
      );
      return JSON.parse(json) as T;
    } catch (error) {
      logger.error({ error }, "Fehler beim Abrufen des Objekts {} mit ID {}", this.typeName, id);
      throw new Error("Fehler beim Abrufen aus der Datenbank");
    } finally {
      conn.close();
    }
  }

  findAll(): T[] {
    logger.info({ type: this.typeName }, "<<< LESE ALLE");
    const sql = "SELECT id, data FROM objects WHERE type = ? ORDER BY created_at DESC";
    const conn = this.db.createNewConnection();
    try {
      const rows = conn.prepare(sql).all(this.typeName) as { id: string; data: string }[];
      const results = rows.map(row => JSON.parse(row.data) as T);
      const foundIds = rows.map(row => row.id);
      logger.info(
        { type: this.typeName, count: results.length, ids: foundIds },
        "<<< GEFUNDEN"
      );
      return results;
    } catch (error) {
      logger.error({ error }, "Fehler beim Abrufen aller Objekte vom Typ {}", this.typeName);
      throw new Error("Fehler beim Abrufen aus der Datenbank");
    } finally {
      conn.close();
    }
  }

  deleteById(id: string): boolean {
    logger.info({ type: this.typeName, id }, ">>> LOESCHE");
    const sql = "DELETE FROM objects WHERE id = ? AND type = ?";
    const conn = this.db.createNewConnection();
    try {
      const result = conn.prepare(sql).run(id, this.typeName);
      const deleted = result.changes > 0;
      if (deleted) {
        logger.info({ type: this.typeName, id }, ">>> GELOESCHT");
      } else {
        logger.info({ type: this.typeName, id }, ">>> NICHT GEFUNDEN ZUM LOESCHEN");
      }
      return deleted;
    } catch (error) {
      logger.error({ error }, "Fehler beim Löschen des Objekts {} mit ID {}", this.typeName, id);
      throw new Error("Fehler beim Löschen aus der Datenbank");
    } finally {
      conn.close();
    }
  }

  existsById(id: string): boolean {
    logger.debug({ type: this.typeName, id }, "Pruefe Existenz von Objekt");
    const sql = "SELECT COUNT(*) AS count FROM objects WHERE id = ? AND type = ?";
    const conn = this.db.createNewConnection();
    try {
      const row = conn.prepare(sql).get(id, this.typeName) as { count: number } | undefined;
      return (row?.count ?? 0) > 0;
    } catch (error) {
      logger.error({ error }, "Fehler beim Pruefen der Existenz von Objekt {} mit ID {}", this.typeName, id);
      throw new Error("Fehler beim Pruefen in der Datenbank");
    } finally {
      conn.close();
    }
  }

  count(): number {
    logger.debug({ type: this.typeName }, "Zaehle Objekte vom Typ");
    const sql = "SELECT COUNT(*) AS count FROM objects WHERE type = ?";
    const conn = this.db.createNewConnection();
    try {
      const row = conn.prepare(sql).get(this.typeName) as { count: number } | undefined;
      const count = row?.count ?? 0;
      logger.debug({ type: this.typeName, count }, "Objekte vom Typ gefunden");
      return count;
    } catch (error) {
      logger.error({ error }, "Fehler beim Zaehlen der Objekte vom Typ {}", this.typeName);
      throw new Error("Fehler beim Zaehlen in der Datenbank");
    } finally {
      conn.close();
    }
  }
}

