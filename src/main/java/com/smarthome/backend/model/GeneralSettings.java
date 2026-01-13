package com.smarthome.backend.model;

import lombok.Data;

/**
 * Allgemeine Einstellungen des Smart Home Systems.
 */
@Data
public class GeneralSettings {
    private String name;
    private String sprache; // 'de' | 'en' | 'fr'
    private String temperatur; // 'celsius' | 'fahrenheit'
}
