import type { Action } from "../../actions/action/Action.js";

/** GET /api/actions – Antwort ist das Aktions-Array. */
export class Response_GetActions {
  constructor(readonly actions: Action[]) {}

  toJSON(): Action[] {
    return this.actions;
  }
}
