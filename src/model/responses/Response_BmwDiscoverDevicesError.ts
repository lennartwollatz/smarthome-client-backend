import type { Response_BmwCredentials } from "./Response_BmwCredentials.js";
import { Response_Error } from "./Response_Error.js";

/** GET /api/modules/bmw/devices/discover – 400, solange die Zugangsdaten keine Discovery erlauben. */
export class Response_BmwDiscoverDevicesError extends Response_Error {
  constructor(
    error: string,
    readonly credentials: Response_BmwCredentials
  ) {
    super(error);
  }
}
