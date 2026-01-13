package com.smarthome.backend.model;

import lombok.Data;

/**
 * Einstellungen für verschiedene Benachrichtigungstypen.
 */
@Data
public class NotificationSettings {
    private Boolean security;
    private Boolean batterystatus;
    private Boolean energyreport;
}
