/** PUT /api/users/:userId – das Frontend erwartet einen leeren JSON-String. */
export class Response_UpdateUser {
  toJSON(): string {
    return "";
  }
}
