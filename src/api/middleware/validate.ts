import type { RequestHandler } from "express";
import type { z } from "zod";
import { Response_Error } from "../../model/responses/Response_Error.js";

/** Layer 2: prüft Pfad-, Query- und Body-Parameter gegen das Schema der Schnittstelle. */
export function validate(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse({ params: req.params, query: req.query, body: req.body ?? {} });
    if (!result.success) {
      const details = result.error.issues.map(issue => ({
        path: issue.path.join("."),
        message: issue.message
      }));
      res.status(400).json(new Response_Error("Ungültige Anfrage", details));
      return;
    }
    res.locals.input = result.data;
    next();
  };
}
