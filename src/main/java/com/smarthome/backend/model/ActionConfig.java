package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;
import java.util.List;

/**
 * Konfiguration für einen Aktions-Knoten im Workflow.
 */
@Data
public class ActionConfig {
    private String type; // 'action' | 'device'
    private String action; // Name der Funktion
    private List<Object> values; // Optional, Array von Werten, erforderlich wenn Aktion Parameter hat
    
    @SerializedName("deviceId")
    private String deviceId; // Optional, ID des Geräts, wenn type 'device' ist
}
