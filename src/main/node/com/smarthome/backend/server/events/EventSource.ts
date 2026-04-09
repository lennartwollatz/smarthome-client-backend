import { AsyncLocalStorage } from "node:async_hooks";

export enum EventSource {
  SYSTEM     = 0,
  USER       = 1,
  AUTOMATION = 2,
  VOICE      = 3,
  SENSOR     = 4,
}

const storage = new AsyncLocalStorage<EventSource>();

export function runWithSource<T>(source: EventSource, fn: () => T): T {
  return storage.run(source, fn);
}

export function getCurrentSource(): EventSource {
  return storage.getStore() ?? EventSource.SYSTEM;
}
