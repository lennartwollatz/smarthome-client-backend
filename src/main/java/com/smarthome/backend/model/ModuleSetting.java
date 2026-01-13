package com.smarthome.backend.model;

import lombok.Data;

/**
 * Einzelne Einstellung für ein Modul.
 */
@Data
public class ModuleSetting {
    private String key;
    private Object value;
}
