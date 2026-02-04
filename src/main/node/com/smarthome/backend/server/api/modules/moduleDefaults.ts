export type ModuleModel = Record<string, unknown> & {
  id?: string;
  name?: string;
  shortDescription?: string;
  longDescription?: string;
  categoryKey?: string;
  icon?: string;
  isInstalled?: boolean;
  isActive?: boolean;
  isPurchased?: boolean;
  isDisabled?: boolean;
  price?: number;
  features?: unknown;
  version?: unknown;
  devices?: unknown;
  moduleData?: Record<string, unknown>;
};

const DEFAULTS: ModuleModel[] = [
  {
    id: "denon",
    name: "Denon HEOS",
    shortDescription: "Steuerung von Denon/HEOS Speakern",
    categoryKey: "audioTv",
    icon: "&#127911;"
  },
  {
    id: "matter",
    name: "Matter",
    shortDescription: "Matter-kompatible Geräte verbinden und steuern",
    categoryKey: "services",
    icon: "&#128268;"
  },
  {
    id: "sonoff",
    name: "Sonoff",
    shortDescription: "Sonoff Geräte verbinden und steuern",
    categoryKey: "lighting",
    icon: "&#128161;"
  },
  {
    id: "hue",
    name: "Hue",
    shortDescription: "Hue Geräte verbinden und steuern",
    categoryKey: "lighting",
    icon: "&#128161;"
  },
  {
    id: "lg",
    name: "LG TV",
    shortDescription: "Verwaltung und Steuerung von LG Fernsehern",
    categoryKey: "audioTv",
    icon: "&#128250;"
  }
];

export function getDefaultModules(): ModuleModel[] {
  return DEFAULTS.map(module => ({
    ...module,
    isInstalled: true,
    isActive: true,
    isPurchased: true,
    isDisabled: false,
    price: 0.0
  }));
}

export function defaultModuleById(moduleId: string): ModuleModel | null {
  const match = DEFAULTS.find(module => module.id === moduleId);
  if (!match) return null;
  return {
    ...match,
    isInstalled: true,
    isActive: true,
    isPurchased: true,
    isDisabled: false,
    price: 0.0
  };
}

