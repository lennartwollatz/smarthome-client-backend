import { Storage } from "@matter/general";
import { fromJson, toJson, type SupportedStorageTypes } from "@matter/general";
import { JsonRepository } from "../../../db/jsonRepository.js";
import type { DatabaseManager } from "../../../db/database.js";

type MatterStorageRow = {
  id: string;
  entries: Record<string, string>;
};

export class MatterDatabaseStorage extends Storage {
  readonly initialized = true;
  private readonly repository: JsonRepository<MatterStorageRow>;

  constructor(databaseManager: DatabaseManager) {
    super();
    this.repository = new JsonRepository<MatterStorageRow>(databaseManager, "MatterStorage");
  }

  initialize(): void {}

  async close(): Promise<void> {}

  clear(): void {
    this.repository.findAll().forEach(row => this.repository.deleteById(row.id));
  }

  get data(): any {
    return this.repository.findAll();
  }

  get(contexts: string[], key: string): SupportedStorageTypes | undefined {
    const row = this.loadRow(contexts);
    const encoded = row.entries[key];
    if (encoded === undefined) {
      return undefined;
    }
    return fromJson(encoded);
  }

  openBlob(): Blob {
    throw new Error("Blob storage is not implemented for MatterDatabaseStorage");
  }

  async writeBlobFromStream(): Promise<void> {
    throw new Error("Blob storage is not implemented for MatterDatabaseStorage");
  }

  set(
    contexts: string[],
    keyOrValues: string | Record<string, SupportedStorageTypes>,
    value?: SupportedStorageTypes
  ): void {
    const row = this.loadRow(contexts);
    if (typeof keyOrValues === "string") {
      row.entries[keyOrValues] = toJson(value);
    } else {
      Object.entries(keyOrValues).forEach(([entryKey, entryValue]) => {
        row.entries[entryKey] = toJson(entryValue);
      });
    }
    this.saveRow(row);
  }

  delete(contexts: string[], key: string): void {
    const row = this.loadRow(contexts);
    delete row.entries[key];
    this.saveRow(row);
  }

  keys(contexts: string[]): string[] {
    const row = this.loadRow(contexts);
    return Object.keys(row.entries);
  }

  values(contexts: string[]): Record<string, SupportedStorageTypes> {
    const row = this.loadRow(contexts);
    const result: Record<string, SupportedStorageTypes> = {};
    Object.entries(row.entries).forEach(([key, encoded]) => {
      result[key] = fromJson(encoded);
    });
    return result;
  }

  contexts(contexts: string[]): string[] {
    const contextKey = this.toContextKey(contexts);
    const directChildren = new Set<string>();
    this.repository.findAll().forEach(row => {
      if (row.id === contextKey) return;
      if (contextKey !== "__root__") {
        if (!row.id.startsWith(`${contextKey}/`)) return;
      }
      const suffix = contextKey === "__root__" ? row.id : row.id.slice(contextKey.length + 1);
      const nextContext = suffix.split("/")[0];
      if (nextContext) {
        directChildren.add(nextContext);
      }
    });
    return [...directChildren];
  }

  clearAll(contexts: string[]): void {
    const contextKey = this.toContextKey(contexts);
    if (contextKey === "__root__") {
      this.repository.findAll().forEach(row => this.repository.deleteById(row.id));
      return;
    }
    this.repository.findAll().forEach(row => {
      if (row.id === contextKey || row.id.startsWith(`${contextKey}/`)) {
        this.repository.deleteById(row.id);
      }
    });
  }

  private loadRow(contexts: string[]): MatterStorageRow {
    const id = this.toContextKey(contexts);
    const row = this.repository.findById(id);
    return row ?? { id, entries: {} };
  }

  private saveRow(row: MatterStorageRow): void {
    this.repository.save(row.id, row);
  }

  private toContextKey(contexts: string[]): string {
    if (contexts.length === 0) {
      return "__root__";
    }
    return contexts.join("/");
  }
}

