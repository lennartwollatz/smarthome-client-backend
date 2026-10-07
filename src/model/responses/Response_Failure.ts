/** Fehlerantwort der Steuerungs-Endpunkte im Format `{ success: false, error? }`. */
export class Response_Failure {
  readonly success = false;
  readonly error?: string;

  constructor(error?: string) {
    if (error) this.error = error;
  }
}
