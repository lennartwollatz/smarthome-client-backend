import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../../config/logger.js";
import { Response_Error } from "../../model/responses/Response_Error.js";
import { ApiError } from "../http/ApiError.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(new Response_Error(`Endpoint not found: ${req.path}`));
};

/** Wandelt ApiError in die fachliche Antwort um; alles andere wird als 500 gemeldet. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json(err.response);
    return;
  }
  if ((err as { type?: string })?.type === "entity.parse.failed") {
    res.status(400).json(new Response_Error("Ungültiges JSON"));
    return;
  }
  logger.error({ err, path: req.path }, "Unbehandelter Fehler in der API");
  res.status(500).json(new Response_Error("Interner Serverfehler"));
};
