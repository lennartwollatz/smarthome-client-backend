import type { ModuleModel } from "../../modules/modules.js";

/** Modul, wie es die Modul-Endpunkte zurückgeben. */
export class Response_Module {
  constructor(readonly module: ModuleModel) {}

  toJSON(): ModuleModel {
    return this.module;
  }
}
