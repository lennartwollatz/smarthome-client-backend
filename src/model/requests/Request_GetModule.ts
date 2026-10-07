/** GET /api/modules/:moduleId */
export class Request_GetModule {
  readonly moduleId!: string;

  constructor(fields: Request_GetModule) {
    Object.assign(this, fields);
  }
}
