/**
 * Bedingungs-Konfiguration fuer Condition-Nodes und while-Loops.
 *
 * Zwei Quellen werden unterstuetzt:
 *  - source='device' (Default, rueckwaertskompatibel): Aufruf einer boolean-Funktion
 *    am Geraet. Felder deviceId/moduleId/property/values werden ausgewertet.
 *  - source='variable': Vergleich einer Workflow-Variable gegen ein Literal oder
 *    eine andere Workflow-Variable. Felder variableName/operator/compareSource/
 *    compareLiteral/compareVariableName werden ausgewertet.
 */
export class ConditionConfig {
  source?: string; // 'device' | 'variable'

  // --- source 'device' ---
  deviceId?: string;
  moduleId?: string;
  property?: string;
  values?: Object[];

  // --- source 'variable' ---
  variableName?: string;
  operator?: string;             // 'equals' | 'notEquals'
  compareSource?: string;        // 'literal' | 'variable'
  compareLiteral?: string;
  compareVariableName?: string;

  constructor(init?: Partial<ConditionConfig>) {
    Object.assign(this, init);
  }
}
