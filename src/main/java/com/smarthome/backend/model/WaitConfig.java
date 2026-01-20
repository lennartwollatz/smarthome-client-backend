package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;

import lombok.Data;

/**
 * Konfiguration für einen Warte-Knoten im Workflow.
 */
@Data
public class WaitConfig {
    private String type; // 'time' | 'trigger'
    
    @SerializedName("waitTime")
    private Integer waitTime; // Optional, Anzahl der Sekunden zum Warten (für 'time' Typ)
    
    @SerializedName("deviceId")
    private String deviceId; // Optional, ID des Geräts für 'trigger' Typ
    
    @SerializedName("triggerEvent")
    private String triggerEvent; // Optional, Name des Trigger-Events für 'trigger' Typ
    
    @SerializedName("triggerValues")
    private java.util.List<Object> triggerValues; // Optional, Werte für den Trigger

    @SerializedName("timeout")
    private Integer timeout; // Optional, Timeout in Sekunden
}
