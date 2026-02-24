import { DENONMODULE } from "./heos/denon/denonModule.js";
import { MATTERMODULE } from "./matter/matterModule.js";
import { HUEMODULE } from "./hue/hueModule.js";
import { LGMODULE } from "./lg/lgModule.js";
import { SONOSMODULE } from "./sonos/sonosModule.js";
import { XIAOMIMODULE } from "./xiaomi/xiaomiModule.js";
import { WACLIGHTINGMODULE } from "./waclighting/waclightingModule.js";
import { BMWMODULE } from "./bmw/bmwModule.js";
import { APPLECALENDARMODULE } from "./appleCalendar/appleCalendarModule.js";
import { CALENDARMODULE } from "./calendar/calendarModule.js";

export interface ModuleConfig {
  id: string;
  managerId: string;
  defaultDeviceName: string;
  deviceTypeName: string;
}

export interface ModuleBridggedConfig extends ModuleConfig {
  bridgeTypeName: string;
}

export interface ModuleModel {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  categoryKey: string;
  icon: string;
  isInstalled?: boolean;
  isActive?: boolean;
  isPurchased?: boolean;
  isDisabled?: boolean;
  price: number;
  features?: unknown;
  version: string;
  devices?: unknown;
  moduleData?: Record<string, unknown>;
};

const DEFAULTS: ModuleModel[] = [
  CALENDARMODULE,
  DENONMODULE,
  MATTERMODULE,
  HUEMODULE,
  LGMODULE,
  SONOSMODULE,
  XIAOMIMODULE,
  WACLIGHTINGMODULE,
  BMWMODULE,
  APPLECALENDARMODULE
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

