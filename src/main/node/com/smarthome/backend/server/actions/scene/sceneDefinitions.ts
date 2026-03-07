/**
 * Standard-Scene-Definitionen
 * Diese werden beim Start initialisiert, wenn sie nicht in der Datenbank existieren
 */
export interface SceneDefinition {
  id: string;
  name: string;
  icon: string;
  showOnHome?: boolean;
  isCustom?: boolean;
}

export const STANDARD_SCENE_DEFINITIONS: SceneDefinition[] = [
  { 
    id: 'good-morning', 
    name: 'home.scenes.goodMorning', 
    icon: '🌅',
    showOnHome: true,
    isCustom: false
  },
  { 
    id: 'good-night', 
    name: 'home.scenes.goodNight', 
    icon: '🌙',
    showOnHome: true,
    isCustom: false
  },
  { 
    id: 'vacation', 
    name: 'home.scenes.vacation', 
    icon: '🏖️',
    showOnHome: true,
    isCustom: false
  },
  { 
    id: 'movie-night', 
    name: 'home.scenes.movieNight', 
    icon: '🎬',
    showOnHome: true,
    isCustom: false
  },
  { 
    id: 'welcome', 
    name: 'home.scenes.welcome', 
    icon: '🏠',
    showOnHome: true,
    isCustom: false
  },
  { 
    id: 'goodbye', 
    name: 'home.scenes.goodbye', 
    icon: '👋',
    showOnHome: true,
    isCustom: false
  }
];

export function getStandardSceneDefinition(sceneId: string): SceneDefinition | undefined {
  return STANDARD_SCENE_DEFINITIONS.find(def => def.id === sceneId);
}

