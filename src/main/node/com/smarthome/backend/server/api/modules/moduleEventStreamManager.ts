export interface ModuleEventStreamManager {
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
  isRunning(): boolean;
  getModuleId(): string;
  getManagerId(): string;
  getDescription(): string;
}

