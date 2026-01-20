package com.smarthome.backend.model;

import java.util.List;

import lombok.Data;

/**
 * Konfiguration für einen Zeit-Trigger.
 */
@Data
public class TimeTrigger {
    private String frequency; // 'daily' | 'weekly' | 'monthly' | 'yearly'
    private String time; // Format HH:mm
    private List<Integer> weekdays; // Optional, 0-6 (Sonntag-Samstag) für wöchentlich

    public String getFrequency(){
        return frequency;
    }

    public String getTime(){
        return time;
    }

    public List<Integer> getWeekdays(){
        return weekdays;
    }
}
