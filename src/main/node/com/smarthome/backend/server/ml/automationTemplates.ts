import type { DeviceCatalog, AutomationPattern } from "./types.js";
import {
  buildAwayHeatingWorkflow,
  buildArrivalHeatingRestoreWorkflow,
  buildCarApproachHeatingWorkflow,
  buildMotionLightWorkflow,
} from "./workflowBuilder.js";

export type AutomationTemplate = {
  id: string;
  patternType: string;
  category: string;
  match(catalog: DeviceCatalog): { confidence: number; evidenceCount: number } | null;
  build(catalog: DeviceCatalog): AutomationPattern | null;
};

function normalizeRoom(room?: string): string {
  return (room ?? "").toLowerCase().trim();
}

function findMotionLightPairs(
  catalog: DeviceCatalog
): Array<{ motion: (typeof catalog.motionSensors)[0]; light: (typeof catalog.lights)[0] }> {
  const pairs: Array<{ motion: (typeof catalog.motionSensors)[0]; light: (typeof catalog.lights)[0] }> = [];
  for (const motion of catalog.motionSensors) {
    const motionRoom = normalizeRoom(motion.room);
    if (!motionRoom) continue;
    for (const light of catalog.lights) {
      if (normalizeRoom(light.room) === motionRoom) {
        pairs.push({ motion, light });
        break;
      }
    }
  }
  return pairs;
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "away_heating_eco",
    patternType: "capability_away_heating",
    category: "Heizung",
    match(catalog) {
      if (catalog.presenceDevices.length === 0 || catalog.thermostats.length === 0) return null;
      const heatable = catalog.thermostats.filter(
        (t) => !["bad", "badezimmer", "bath"].some((ex) => normalizeRoom(t.room).includes(ex))
      );
      if (heatable.length === 0) return null;
      return {
        confidence: Math.min(0.95, 0.7 + catalog.presenceDevices.length * 0.05 + heatable.length * 0.03),
        evidenceCount: catalog.presenceDevices.length + heatable.length,
      };
    },
    build(catalog) {
      const match = this.match(catalog);
      if (!match) return null;
      const workflow = buildAwayHeatingWorkflow(catalog.presenceDevices, catalog.thermostats);
      if (!workflow) return null;
      return {
        patternId: this.id,
        patternType: this.patternType,
        name: "Abwesenheit — Heizung absenken",
        description:
          "Wenn alle Bewohner das Haus verlassen, wird die Zieltemperatur gespeichert und die Heizung (außer im Bad) auf Eco-Temperatur gesenkt.",
        confidence: match.confidence,
        evidenceCount: match.evidenceCount,
        category: this.category,
        actionDrafts: [{ name: "Abwesenheit — Heizung Eco", triggerType: "device", workflow }],
      };
    },
  },
  {
    id: "arrival_heating_restore",
    patternType: "capability_arrival_heating",
    category: "Heizung",
    match(catalog) {
      if (catalog.presenceDevices.length === 0 || catalog.thermostats.length === 0) return null;
      return {
        confidence: Math.min(0.9, 0.65 + catalog.thermostats.length * 0.04),
        evidenceCount: catalog.thermostats.length,
      };
    },
    build(catalog) {
      const match = this.match(catalog);
      if (!match) return null;
      const workflow = buildArrivalHeatingRestoreWorkflow(catalog.presenceDevices, catalog.thermostats);
      if (!workflow) return null;
      return {
        patternId: this.id,
        patternType: this.patternType,
        name: "Ankunft — Heizung wiederherstellen",
        description:
          "Wenn jemand nach Hause kommt, werden die zuvor gespeicherten Zieltemperaturen wiederhergestellt. Am besten zusammen mit „Abwesenheit — Heizung absenken“ aktivieren.",
        confidence: match.confidence,
        evidenceCount: match.evidenceCount,
        category: this.category,
        actionDrafts: [{ name: "Ankunft — Heizung wiederherstellen", triggerType: "device", workflow }],
      };
    },
  },
  {
    id: "car_approach_heating",
    patternType: "capability_car_arrival_heating",
    category: "Heizung",
    match(catalog) {
      if (catalog.cars.length === 0 || catalog.thermostats.length === 0) return null;
      return { confidence: 0.75, evidenceCount: catalog.cars.length };
    },
    build(catalog) {
      const match = this.match(catalog);
      if (!match || catalog.cars.length === 0) return null;
      const car = catalog.cars[0];
      const workflow = buildCarApproachHeatingWorkflow(car, catalog.thermostats);
      if (!workflow) return null;
      return {
        patternId: this.id,
        patternType: this.patternType,
        name: "Auto nähert sich — Heizung vorheizen",
        description:
          "Bei Standortänderung des Fahrzeugs werden die Thermostate auf Komforttemperatur gesetzt. Radius/Heimzone kann nach der Aktivierung im Workflow angepasst werden.",
        confidence: match.confidence,
        evidenceCount: match.evidenceCount,
        category: this.category,
        actionDrafts: [{ name: `Auto (${car.name}) — Heizung vorheizen`, triggerType: "device", workflow }],
      };
    },
  },
  {
    id: "motion_light_same_room",
    patternType: "capability_motion_light",
    category: "Beleuchtung",
    match(catalog) {
      const pairs = findMotionLightPairs(catalog);
      if (pairs.length === 0) return null;
      return { confidence: Math.min(0.88, 0.6 + pairs.length * 0.08), evidenceCount: pairs.length };
    },
    build(catalog) {
      const match = this.match(catalog);
      if (!match) return null;
      const pairs = findMotionLightPairs(catalog);
      const drafts = pairs
        .slice(0, 5)
        .map(({ motion, light }) => {
          const workflow = buildMotionLightWorkflow(motion, light);
          if (!workflow) return null;
          return {
            name: `Bewegung → Licht (${light.room ?? light.name})`,
            triggerType: "device" as const,
            workflow,
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);
      if (drafts.length === 0) return null;
      return {
        patternId: this.id,
        patternType: this.patternType,
        name: "Bewegung schaltet Licht",
        description: "Bei Bewegung im Raum wird das zugehörige Licht eingeschaltet.",
        confidence: match.confidence,
        evidenceCount: match.evidenceCount,
        category: this.category,
        actionDrafts: drafts,
      };
    },
  },
];

export function buildCombinedHeatingPackage(catalog: DeviceCatalog): AutomationPattern | null {
  const away = AUTOMATION_TEMPLATES.find((t) => t.id === "away_heating_eco")!.build(catalog);
  const arrival = AUTOMATION_TEMPLATES.find((t) => t.id === "arrival_heating_restore")!.build(catalog);
  const car = AUTOMATION_TEMPLATES.find((t) => t.id === "car_approach_heating")!.build(catalog);
  if (!away && !arrival) return null;

  const drafts = [
    ...(away?.actionDrafts ?? []),
    ...(arrival?.actionDrafts ?? []),
    ...(car?.actionDrafts ?? []),
  ];
  if (drafts.length === 0) return null;

  return {
    patternId: "heating_presence_car_package",
    patternType: "capability_heating_package",
    name: "Heizung: Abwesenheit, Ankunft & Auto",
    description:
      "Alle Personen verlassen das Haus → Heizung runter (Bad ausgenommen). Bei Ankunft oder wenn sich das Auto nähert → gespeicherte bzw. Komfort-Temperaturen.",
    confidence: drafts.length >= 3 ? 0.92 : Math.max(away?.confidence ?? 0, arrival?.confidence ?? 0, car?.confidence ?? 0),
    evidenceCount: catalog.presenceDevices.length + catalog.thermostats.length + catalog.cars.length,
    category: "Heizung",
    actionDrafts: drafts,
  };
}

export function discoverTemplatePatterns(catalog: DeviceCatalog): AutomationPattern[] {
  const patterns: AutomationPattern[] = [];
  const seenTypes = new Set(catalog.existingPatternTypes);

  const heatingPackage = buildCombinedHeatingPackage(catalog);
  if (heatingPackage && !seenTypes.has(heatingPackage.patternType)) {
    patterns.push(heatingPackage);
  }

  for (const template of AUTOMATION_TEMPLATES) {
    if (seenTypes.has(template.patternType)) continue;
    if (template.id === "away_heating_eco" || template.id === "arrival_heating_restore" || template.id === "car_approach_heating") {
      continue;
    }
    const pattern = template.build(catalog);
    if (pattern && pattern.actionDrafts.length > 0) {
      patterns.push(pattern);
    }
  }

  return patterns;
}
