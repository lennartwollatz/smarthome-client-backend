import type { RequestHandler } from "express";
import type { z } from "zod";
import { validate } from "../middleware/validate.js";

export type EndpointSpec<TSchema extends z.ZodType, TRequest, TResponse> = {
  /** Layer 2: Schema für `{ params, query, body }`. */
  schema: TSchema;
  /** Layer 3: validierte Eingabe in die Request-Klasse füllen. */
  toRequest: (input: z.output<TSchema>) => TRequest;
  /** Layer 4: Request an den Service übergeben; Ergebnis ist die Response-Klasse (Layer 6). */
  serve: (request: TRequest) => Promise<TResponse> | TResponse;
  status?: number;
};

/** Baut die Handler-Kette eines Endpunkts; Layer 1 (Authentifizierung) hängt am API-Router. */
export function endpoint<TSchema extends z.ZodType, TRequest, TResponse>(
  spec: EndpointSpec<TSchema, TRequest, TResponse>
): RequestHandler[] {
  const handler: RequestHandler = async (_req, res, next) => {
    try {
      const request = spec.toRequest(res.locals.input as z.output<TSchema>);
      const response = await spec.serve(request);
      res.status(spec.status ?? 200).json(response);
    } catch (err) {
      next(err);
    }
  };
  return [validate(spec.schema), handler];
}
