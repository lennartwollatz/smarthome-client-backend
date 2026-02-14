import type { ILogger, LogLevel } from "bmw-connected-drive";
import { logger } from "../../../../logger.js";

export class BMWConnectedDriveLogger implements ILogger {
  Log(_level: LogLevel, message: string): void {
    // Fallback – wir nutzen die Convenience-Methoden unten
    logger.info({ message }, "BMW ConnectedDrive");
  }

  LogTrace(message: string): void {
    logger.debug({ message }, "BMW ConnectedDrive trace");
  }

  LogDebug(message: string): void {
    logger.debug({ message }, "BMW ConnectedDrive debug");
  }

  LogInformation(message: string): void {
    logger.info({ message }, "BMW ConnectedDrive info");
  }

  LogWarning(message: string): void {
    logger.warn({ message }, "BMW ConnectedDrive warn");
  }

  LogError(message: string): void {
    logger.error({ message }, "BMW ConnectedDrive error");
  }

  LogCritical(message: string): void {
    // Fallback: unser Logger-Typ bietet kein fatal() an
    logger.error({ message }, "BMW ConnectedDrive critical");
  }
}


