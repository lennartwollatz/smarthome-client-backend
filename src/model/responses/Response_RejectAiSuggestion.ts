/** POST /api/actions/:actionId/reject – Antwort ist `true`. */
export class Response_RejectAiSuggestion {
  toJSON(): boolean {
    return true;
  }
}
