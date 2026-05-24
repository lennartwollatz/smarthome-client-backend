/**
 * Konfiguration fuer Variable-Nodes im Workflow.
 * Eine Variable hat einen Namen und einen String-Wert. Mehrere Variable-Nodes
 * mit gleichem Namen ueberschreiben den Wert in der Ausfuehrungs-Environment.
 *
 * valueSource 'manual': value wird direkt gesetzt.
 * valueSource 'device': property am Geraet wird ausgewertet, value wird 'true' oder 'false'.
 */
export class VariableConfig {
  name?: string;
  value?: string;
  valueSource?: string; // 'manual' | 'device'
  deviceId?: string;
  moduleId?: string;
  property?: string;
  values?: Object[];

  constructor(init?: Partial<VariableConfig>) {
    Object.assign(this, init);
  }
}
