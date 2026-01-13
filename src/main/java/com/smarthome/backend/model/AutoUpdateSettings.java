package com.smarthome.backend.model;

import lombok.Data;

/**
 * Einstellungen für automatische System-Updates.
 */
@Data
public class AutoUpdateSettings {
    private Boolean autoupdate;
    private UpdateTimes updatetimes;
}
