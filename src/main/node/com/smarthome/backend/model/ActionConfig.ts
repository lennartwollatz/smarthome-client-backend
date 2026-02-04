/**
 * Konfiguration für Aktionen im Workflow.
 * Kompatibel mit Frontend-Datenmodell.
 * 
 * @property type - Typ der Aktion: 'device' | 'scene' | 'action'
 * @property action - Name der auszuführenden Funktion (für device)
 * @property values - Parameter-Werte für die Aktion
 * @property deviceId - ID des Zielgeräts (für type='device')
 * @property moduleId - ID des Moduls des Geräts
 * @property sceneId - ID der Szene (für type='scene')
 * @property actionId - ID einer verschachtelten Aktion (für type='action')
 */
export class ActionConfig {
  type?: string; // 'device' | 'scene' | 'action'
  action?: string;
  values?: unknown[];
  deviceId?: string;
  moduleId?: string;
  sceneId?: string;
  actionId?: string;

  constructor(init?: Partial<ActionConfig>) {
    Object.assign(this, init);
  }
}
