/**
 * Konfiguration für Warte-Knoten im Workflow.
 * Kompatibel mit Frontend-Datenmodell.
 * 
 * @property type - Typ des Wartens: 'time' | 'trigger'
 * @property waitTime - Wartezeit in Millisekunden (für type='time')
 * @property deviceId - ID des Geräts für Trigger-Event (für type='trigger')
 * @property moduleId - ID des Moduls des Geräts
 * @property triggerEvent - Name des Trigger-Events
 * @property triggerValues - Parameterwerte für den Trigger
 * @property timeout - Timeout in Millisekunden (für type='trigger')
 */
export class WaitConfig {
  type?: string; // 'time' | 'trigger'
  waitTime?: number;
  deviceId?: string;
  moduleId?: string;
  triggerEvent?: string;
  triggerValues?: unknown[];
  timeout?: number;

  constructor(init?: Partial<WaitConfig>) {
    Object.assign(this, init);
  }
}
