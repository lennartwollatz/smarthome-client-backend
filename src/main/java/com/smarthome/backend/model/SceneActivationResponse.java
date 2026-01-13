package com.smarthome.backend.model;

import lombok.Data;

/**
 * Antwort nach Aktivierung oder Deaktivierung einer Szene.
 */
@Data
public class SceneActivationResponse {
    private String id;
    private String name;
    private Boolean active;
}
