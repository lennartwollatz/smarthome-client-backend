/** GET /api/modules/:moduleId/uninstall – das Frontend erwartet `true`. */
export class Response_UninstallModule {
  toJSON(): boolean {
    return true;
  }
}
