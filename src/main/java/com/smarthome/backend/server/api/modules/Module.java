package com.smarthome.backend.server.api.modules;

import java.util.ArrayList;
import java.util.List;

/**
 * Enum für die verschiedenen Module im Smart Home System.
 */
public enum Module {
    /**
     * DENON-Modul für Denon HEOS-Geräte.
     */
    DENON(
        "denon",
        "Denon HEOS",
        "Steuerung von Denon/HEOS Speakern",
        "audioTv",
        "&#127911;" // Kopfhörer
    ),
    
    /**
     * Matter-Modul für Matter-kompatible Geräte.
     */
    MATTER(
        "matter",
        "Matter",
        "Matter-kompatible Geräte verbinden und steuern",
        "services",
        "&#128268;" // Stecker
    ),

    /**
     * Sonoff-Modul (falls noch nicht implementiert, dennoch als Default in der Modul-Liste sichtbar).
     */
    SONOFF(
        "sonoff",
        "Sonoff",
        "Sonoff Geräte verbinden und steuern",
        "lighting",
        "&#128161;" // Glühbirne
    ),

    /**
     * Sonoff-Modul (falls noch nicht implementiert, dennoch als Default in der Modul-Liste sichtbar).
     */
    HUE(
        "hue",
        "Hue",
        "Hue Geräte verbinden und steuern",
        "lighting",
        "&#128161;" // Glühbirne
    );
    
    private final String moduleId;
    private final String name;
    private final String shortDescription;
    private final String categoryKey;
    private final String icon;
    
    Module(String moduleId, String name, String shortDescription, String categoryKey, String icon) {
        this.moduleId = moduleId;
        this.name = name;
        this.shortDescription = shortDescription;
        this.categoryKey = categoryKey;
        this.icon = icon;
    }
    
    /**
     * Gibt die Module-ID als String zurück.
     * 
     * @return Die Module-ID
     */
    public String getModuleId() {
        return moduleId;
    }

    public String getName() {
        return name;
    }

    public String getShortDescription() {
        return shortDescription;
    }

    public String getCategoryKey() {
        return categoryKey;
    }

    public String getIcon() {
        return icon;
    }

    /**
     * Erzeugt das Default-Objekt für dieses Modul als {@link com.smarthome.backend.model.Module}.
     */
    public com.smarthome.backend.model.Module toDefaultModel() {
        com.smarthome.backend.model.Module module = new com.smarthome.backend.model.Module();
        module.setId(moduleId);
        module.setName(name);
        module.setShortDescription(shortDescription);
        module.setCategoryKey(categoryKey);
        module.setIcon(icon);

        // sensible Defaults
        module.setIsInstalled(true);
        module.setIsActive(true);
        module.setIsPurchased(true);
        module.setIsDisabled(false);
        module.setPrice(0.0);
        return module;
    }

    public static List<com.smarthome.backend.model.Module> getDefaultModules() {
        List<com.smarthome.backend.model.Module> defaults = new ArrayList<>();
        for (Module module : Module.values()) {
            defaults.add(module.toDefaultModel());
        }
        return defaults;
    }
    
    /**
     * Konvertiert einen String in das entsprechende Module-Enum.
     * 
     * @param moduleId Die Module-ID als String
     * @return Das entsprechende Module-Enum oder null, wenn nicht gefunden
     */
    public static Module fromModuleId(String moduleId) {
        if (moduleId == null) {
            return null;
        }
        for (Module module : Module.values()) {
            if (module.moduleId.equals(moduleId)) {
                return module;
            }
        }
        return null;
    }
}

