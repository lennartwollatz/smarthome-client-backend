import { Response_Error } from "../../model/responses/Response_Error.js";

/** Fachlicher Fehler eines Services; der Error-Handler sendet `response` mit `status`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly response: object
  ) {
    super(`HTTP ${status}`);
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, new Response_Error(message));
  }

  static forbidden(message: string): ApiError {
    return new ApiError(403, new Response_Error(message));
  }

  static notFound(message: string): ApiError {
    return new ApiError(404, new Response_Error(message));
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, new Response_Error(message));
  }

  static internal(message: string): ApiError {
    return new ApiError(500, new Response_Error(message));
  }
}
