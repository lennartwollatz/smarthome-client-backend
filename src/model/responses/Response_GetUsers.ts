import type { Response_User } from "./Response_User.js";

/** GET /api/users – Antwort ist das Benutzer-Array. */
export class Response_GetUsers {
  constructor(readonly users: Response_User[]) {}

  toJSON(): Response_User[] {
    return this.users;
  }
}
