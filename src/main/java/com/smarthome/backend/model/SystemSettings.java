package com.smarthome.backend.model;

import lombok.Data;

/**
 * System-Einstellungen, einschließlich Versionsinformationen und Auto-Update-Einstellungen.
 */
@Data
public class SystemSettings {
    private VersionInfo frontend;
    private VersionInfo backend;
    private Boolean autoupdate;
    private UpdateTimes updatetimes;
    private String serverIp;
}
