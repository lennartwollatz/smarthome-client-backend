/** POST /api/settings/system/install-update */
export class Request_InstallUpdate {
  readonly component!: "frontend" | "backend";

  constructor(fields: Request_InstallUpdate) {
    Object.assign(this, fields);
  }
}
