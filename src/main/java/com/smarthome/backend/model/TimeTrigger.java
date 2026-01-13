package com.smarthome.backend.model;

import lombok.Data;
import java.util.List;

/**
 * Konfiguration für einen Zeit-Trigger.
 */
@Data
public class TimeTrigger {
    private String frequency; // 'daily' | 'weekly' | 'monthly' | 'yearly'
    private String time; // Format HH:mm
    private List<Integer> weekdays; // Optional, 0-6 (Sonntag-Samstag) für wöchentlich
}
