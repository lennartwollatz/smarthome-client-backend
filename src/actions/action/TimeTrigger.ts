/**
 * Konfiguration für zeitbasierte Trigger.
 * Kompatibel mit Frontend-Datenmodell.
 * 
 * @property frequency - Häufigkeit: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly'
 * @property time - Uhrzeit im Format "HH:mm"
 * @property weekdays - Array von Wochentagen (0=Sonntag, 6=Samstag) für weekly
 * @property dayOfMonth - Tag des Monats (1-31) für monthly
 * @property month - Monat (1-12) für yearly
 * @property dayOfYear - Tag des Jahres für yearly (Alternative zu month+dayOfMonth)
 */
export class TimeTrigger {
  frequency?: string; // 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  time?: string;
  weekdays?: number[];
  dayOfMonth?: number;
  month?: number;
  dayOfYear?: number;

  constructor(init?: Partial<TimeTrigger>) {
    Object.assign(this, init);
  }
}
