/** POST /api/modules/:moduleId – Antwort ist der neue Aktivierungsstatus als JSON-Boolean. */
export class Response_SetModuleActive {
  constructor(readonly isActive: boolean) {}

  toJSON(): boolean {
    return this.isActive;
  }
}
