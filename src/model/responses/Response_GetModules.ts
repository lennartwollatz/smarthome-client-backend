import type { Response_Module } from "./Response_Module.js";

/** GET /api/modules – Antwort ist das Modul-Array (gespeicherte Module ergänzt um alle Standardmodule). */
export class Response_GetModules {
  constructor(readonly modules: Response_Module[]) {}

  toJSON(): Response_Module[] {
    return this.modules;
  }
}
