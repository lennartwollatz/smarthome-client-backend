package com.smarthome.backend.model;

import lombok.Data;

/**
 * Request-Objekt für die Aktualisierung einer System-Komponente.
 */
@Data
public class UpdateComponentRequest {
    private String component; // 'frontend' | 'backend'
}
