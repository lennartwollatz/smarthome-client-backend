import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { getAppConfig } from "../../config/appConfig.js";
import { Response_Error } from "../../model/responses/Response_Error.js";

const BEARER_PREFIX = "Bearer ";

/** Vergleicht in konstanter Zeit mit API_TOKEN aus der .env. */
export function isValidApiToken(token: unknown): boolean {
  if (typeof token !== "string" || token.length === 0) return false;
  const expected = Buffer.from(getAppConfig().apiToken);
  const actual = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Layer 1: Jede Anfrage muss `Authorization: Bearer <API_TOKEN>` mitsenden. */
export const authenticate: RequestHandler = (req, res, next) => {
  const header = req.header("authorization");
  const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length).trim() : undefined;
  if (!isValidApiToken(token)) {
    res.status(401).json(new Response_Error("Nicht authentifiziert"));
    return;
  }
  next();
};
