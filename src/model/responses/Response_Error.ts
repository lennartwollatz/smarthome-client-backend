export type Response_ErrorDetail = {
  path: string;
  message: string;
};

/** Einheitliche Fehlerantwort, z. B. `{ error: "User not found" }`. */
export class Response_Error {
  readonly error: string;
  readonly details?: Response_ErrorDetail[];

  constructor(error: string, details?: Response_ErrorDetail[]) {
    this.error = error;
    if (details?.length) this.details = details;
  }
}
