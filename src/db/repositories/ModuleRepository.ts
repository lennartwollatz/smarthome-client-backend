import type { RowDataPacket } from "mysql2/promise";
import { DbModule } from "../../model/db/DbModule.js";
import { defaultModuleById, type ModuleModel } from "../../modules/modules.js";
import type { DatabaseManager } from "../database.js";
import { toBoolean } from "../sqlValues.js";

const SQL_SELECT_MODULES = `
  SELECT
      m.id,
      m.is_installed AS isInstalled,
      m.is_active    AS isActive,
      m.is_purchased AS isPurchased,
      m.is_disabled  AS isDisabled
  FROM modules AS m`;

const SQL_SELECT_ALL_MODULES = `${SQL_SELECT_MODULES}
  ORDER BY m.id`;

const SQL_SELECT_MODULE_BY_ID = `${SQL_SELECT_MODULES}
  WHERE m.id = ?`;

const SQL_UPSERT_MODULE = `
  INSERT INTO modules (id, is_installed, is_active, is_purchased, is_disabled)
  VALUES (?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      is_installed = incoming.is_installed,
      is_active    = incoming.is_active,
      is_purchased = incoming.is_purchased,
      is_disabled  = incoming.is_disabled`;

/** Speichert nur den Zustand; die Stammdaten kommen aus der Moduldefinition im Code. */
export class ModuleRepository {
  constructor(private readonly db: DatabaseManager) {}

  async findAll(): Promise<ModuleModel[]> {
    const rows = await this.db.query<RowDataPacket>(SQL_SELECT_ALL_MODULES);
    return rows
      .map(row => toModule(toDbModule(row)))
      .filter((module): module is ModuleModel => module !== null);
  }

  async findById(id: string): Promise<ModuleModel | null> {
    const [row] = await this.db.query<RowDataPacket>(SQL_SELECT_MODULE_BY_ID, [id]);
    return row ? toModule(toDbModule(row)) : null;
  }

  async save(module: ModuleModel): Promise<void> {
    const dbModule = new DbModule({
      id: module.id,
      isInstalled: module.isInstalled !== false,
      isActive: module.isActive !== false,
      isPurchased: module.isPurchased !== false,
      isDisabled: module.isDisabled === true
    });
    await this.db.execute(SQL_UPSERT_MODULE, [
      dbModule.id,
      dbModule.isInstalled,
      dbModule.isActive,
      dbModule.isPurchased,
      dbModule.isDisabled
    ]);
  }
}

function toDbModule(row: RowDataPacket): DbModule {
  return new DbModule({
    id: row.id,
    isInstalled: toBoolean(row.isInstalled),
    isActive: toBoolean(row.isActive),
    isPurchased: toBoolean(row.isPurchased),
    isDisabled: toBoolean(row.isDisabled)
  });
}

function toModule(dbModule: DbModule): ModuleModel | null {
  const definition = defaultModuleById(dbModule.id);
  if (!definition) return null;
  return {
    ...definition,
    isInstalled: dbModule.isInstalled,
    isActive: dbModule.isActive,
    isPurchased: dbModule.isPurchased,
    isDisabled: dbModule.isDisabled
  };
}
