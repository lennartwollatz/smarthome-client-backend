import type { DeviceType } from "../../model/devices/helper/DeviceType.js";
import type { EventType } from "../events/event-types/EventType.js";

/** Gerät mit Metadaten für Vorschlags-Engine und optional LLM-Kontext. */
export type CatalogDevice = {
  id: string;
  name: string;
  type: DeviceType | string;
  room?: string;
  moduleId?: string;
  /** Öffentliche Workflow-Methoden (Trigger/Bedingungen/Aktionen). */
  methods: string[];
};

/** Kontext aus Geräten, Nutzern und bestehenden Automationen. */
export type DeviceCatalog = {
  devices: CatalogDevice[];
  presenceDevices: CatalogDevice[];
  thermostats: CatalogDevice[];
  cars: CatalogDevice[];
  motionSensors: CatalogDevice[];
  lights: CatalogDevice[];
  users: { id: string; name: string; presenceDeviceId?: string }[];
  existingAutomationNames: string[];
  existingPatternTypes: string[];
};

/** Internes Muster vor der Workflow-Kompilierung. */
export type AutomationPattern = {
  patternId: string;
  patternType: string;
  name: string;
  description: string;
  confidence: number;
  evidenceCount: number;
  category?: string;
  /** Vorgeschlagene Actions (1 Muster kann mehrere Flows erzeugen). */
  actionDrafts: ActionDraft[];
};

export type ActionDraft = {
  name: string;
  triggerType: "manual" | "device" | "time" | "voice_assistant";
  workflow: import("../api/entities/actions/action/Workflow.js").Workflow;
};

export type SuggestionRunResult = {
  analyzedAt: string;
  patternsFound: number;
  suggestionsCreated: number;
  suggestionsSkipped: number;
  errors: string[];
};

export type LlmAutomationIdea = {
  name: string;
  description: string;
  patternType: string;
  confidence: number;
  triggerHint?: string;
  actionHints?: string[];
};

/** Trigger-Referenz für Template-Kompilierung. */
export type DeviceEventTriggerRef = {
  deviceId: string;
  moduleId?: string;
  eventType: EventType;
};
