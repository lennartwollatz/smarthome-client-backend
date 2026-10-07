/** DELETE /api/actions/:actionId – Antwort ist `true`. */
export class Response_DeleteAction {
  toJSON(): boolean {
    return true;
  }
}
