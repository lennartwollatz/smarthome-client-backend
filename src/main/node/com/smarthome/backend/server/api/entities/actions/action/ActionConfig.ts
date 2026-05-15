import { ActionStep } from "./ActionStep.js";

/**
 * Konfiguration fuer Aktionen im Workflow.
 * Kompatibel mit Frontend-Datenmodell.
 *
 * @property type - Typ der Aktion: 'device' | 'scene' | 'action' | 'room'
 * @property roomId - Grundriss-Raum-ID; leer = alle Raeume (nur type='room')
 * @property roomCategory - Kategorie: light | speaker | media | cleaner | fan
 * @property roomCommand - on | off
 * @property steps - Liste von Funktionsaufrufen auf demselben Geraet (fuer type='device')
 * @property deviceId - ID des Zielgeraets (fuer type='device')
 * @property moduleId - ID des Moduls des Geraets
 * @property sceneId - ID der Szene (fuer type='scene')
 * @property actionId - ID einer verschachtelten Aktion (fuer type='action')
 */
export class ActionConfig {
  type?: string; // 'device' | 'scene' | 'action' | 'room'
  steps?: ActionStep[];
  deviceId?: string;
  moduleId?: string;
  sceneId?: string;
  actionId?: string;
  roomId?: string;
  roomCategory?: string;
  roomCommand?: string;

  /** @deprecated Wird beim Laden in `steps[0].action` migriert. */
  action?: string;
  /** @deprecated Wird beim Laden in `steps[0].values` migriert. */
  values?: unknown[];

  constructor(init?: Partial<ActionConfig>) {
    Object.assign(this, init);
    this.steps = ActionConfig.normalizeSteps(this);
    // Legacy-Felder nach Migration entfernen, damit nur das neue Format persistiert wird.
    delete this.action;
    delete this.values;
  }

  /**
   * Migriert Legacy-Felder (`action` + `values`) in `steps[]`.
   * Wird nur fuer type='device' angewendet; bei anderen Typen bleiben `steps` ungenutzt.
   */
  private static normalizeSteps(config: ActionConfig): ActionStep[] | undefined {
    if (config.type !== "device") {
      return undefined;
    }
    const existing = config.steps;
    if (Array.isArray(existing) && existing.length > 0) {
      return existing.map(s => new ActionStep({
        action: s.action,
        values: Array.isArray(s.values) ? [...s.values] : undefined,
      }));
    }
    if (config.action) {
      return [new ActionStep({
        action: config.action,
        values: Array.isArray(config.values) ? [...config.values] : undefined,
      })];
    }
    return [];
  }
}
