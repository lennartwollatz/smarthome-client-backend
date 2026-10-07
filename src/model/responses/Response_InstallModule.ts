/** GET /api/modules/:moduleId/install – das Frontend erwartet `true`. */
export class Response_InstallModule {
  toJSON(): boolean {
    return true;
  }
}
