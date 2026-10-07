/** GET /api/modules/:moduleId/install */
export class Request_InstallModule {
  readonly moduleId!: string;

  constructor(fields: Request_InstallModule) {
    Object.assign(this, fields);
  }
}
