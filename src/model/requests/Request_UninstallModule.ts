/** GET /api/modules/:moduleId/uninstall */
export class Request_UninstallModule {
  readonly moduleId!: string;

  constructor(fields: Request_UninstallModule) {
    Object.assign(this, fields);
  }
}
