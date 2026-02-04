export type ModuleEntry = {
  moduleId: string;
  name: string;
  shortDescription: string;
  categoryKey: string;
  icon: string;
};

const MODULES: ModuleEntry[] = [
  {
    moduleId: "denon",
    name: "Denon HEOS",
    shortDescription: "Steuerung von Denon/HEOS Speakern",
    categoryKey: "audioTv",
    icon: "&#127911;"
  },
  {
    moduleId: "matter",
    name: "Matter",
    shortDescription: "Matter-kompatible Geräte verbinden und steuern",
    categoryKey: "services",
    icon: "&#128268;"
  },
  {
    moduleId: "sonoff",
    name: "Sonoff",
    shortDescription: "Sonoff Geräte verbinden und steuern",
    categoryKey: "lighting",
    icon: "&#128161;"
  },
  {
    moduleId: "hue",
    name: "Hue",
    shortDescription: "Hue Geräte verbinden und steuern",
    categoryKey: "lighting",
    icon: "&#128161;"
  },
  {
    moduleId: "lg",
    name: "LG TV",
    shortDescription: "Verwaltung und Steuerung von LG Fernsehern",
    categoryKey: "audioTv",
    icon: "&#128250;"
  }
];

export function getDefaultModules() {
  return MODULES.map(module => ({
    id: module.moduleId,
    name: module.name,
    shortDescription: module.shortDescription,
    categoryKey: module.categoryKey,
    icon: module.icon,
    isInstalled: true,
    isActive: true,
    isPurchased: true,
    isDisabled: false,
    price: 0.0
  }));
}

export function fromModuleId(moduleId: string | null | undefined) {
  if (!moduleId) return null;
  return MODULES.find(module => module.moduleId === moduleId) ?? null;
}

