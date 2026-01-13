package com.smarthome.backend.model;

import lombok.Data;

/**
 * Enthält Informationen über die aktuellen und verfügbaren Versionen von Frontend
 * und Backend.
 */
@Data
public class SystemInfo {
    private VersionInfo frontend;
    private VersionInfo backend;
    private String serverIp;
}
