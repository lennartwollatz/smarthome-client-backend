import type { Action } from "../../actions/action/Action.js";

/** Aktion, wie sie die Aktions-Endpunkte zurückgeben. */
export class Response_Action {
  constructor(readonly action: Action) {}

  toJSON(): Action {
    return this.action;
  }
}
