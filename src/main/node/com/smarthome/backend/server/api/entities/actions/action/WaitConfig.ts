import { EventParameter } from "../../../../events/event-types/EventParameter.js";
import { EventType } from "../../../../events/event-types/EventType.js";

/**
 * Konfiguration für Warte-Knoten im Workflow.
 * Kompatibel mit Frontend-Datenmodell.
 * 
 * @property type - Typ des Wartens: 'time' | 'trigger' | 'untilTime'
 * @property waitTime - Wartezeit in Sekunden (fuer type='time')
 * @property waitUntilTime - Ziel-Uhrzeit HH:mm (fuer type='untilTime')
 * @property deviceId - ID des Geräts für Trigger-Event (für type='trigger')
 * @property moduleId - ID des Moduls des Geräts
 * @property triggerEvent - Name des Trigger-Events
 * @property triggerValues - Parameterwerte für den Trigger
 * @property timeout - Timeout in Millisekunden (für type='trigger')
 */
export class WaitConfig {
  type?: string; // 'time' | 'trigger' | 'untilTime'
  waitTime?: number;
  waitUntilTime?: string;
  deviceId?: string;
  moduleId?: string;
  triggerEvent?: EventType;
  triggerValues?: EventParameter[];
  timeout?: number;

  constructor(init?: Partial<WaitConfig>) {
    Object.assign(this, init);
  }
}
