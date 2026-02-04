import pino from "pino";

type LoggerLike = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info"
}) as unknown as LoggerLike;

