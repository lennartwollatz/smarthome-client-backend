/**
 * Ein einzelner Schritt eines Action-Nodes vom Typ "device":
 * Funktionsname + Parameterwerte fuer den Aufruf auf dem gemeinsamen Geraet.
 */
export class ActionStep {
  action?: string;
  values?: unknown[];

  constructor(init?: Partial<ActionStep>) {
    Object.assign(this, init);
  }
}
