package com.smarthome.backend.model;

import lombok.Data;

/**
 * Vollständige Einstellungen des Systems, einschließlich allgemeiner Einstellungen,
 * Benachrichtigungen, Datenschutz und System-Einstellungen.
 */
@Data
public class Settings {
    private GeneralSettings allgemein;
    private NotificationSettings notifications;
    private PrivacySettings privacy;
    private SystemSettings system;
}
