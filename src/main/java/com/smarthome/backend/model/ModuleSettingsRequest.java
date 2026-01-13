package com.smarthome.backend.model;

import lombok.Data;
import java.util.List;

/**
 * Request-Objekt für die Aktualisierung von Modul-Einstellungen.
 */
@Data
public class ModuleSettingsRequest {
    private List<ModuleSetting> settings;
}
