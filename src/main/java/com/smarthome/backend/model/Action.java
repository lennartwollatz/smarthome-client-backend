package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

/**
 * Repräsentiert eine Aktion mit Workflow-Konfiguration, die ausgelöst werden kann.
 */
@Data
public class Action {
    @SerializedName("actionId")
    private String actionId;
    
    private String name;
    
    @SerializedName("triggerType")
    private String triggerType; // 'manual' | 'device' | 'time'
    
    private Workflow workflow;
    
    @SerializedName("createdAt")
    private String createdAt; // ISO 8601 Zeitstempel
    
    @SerializedName("updatedAt")
    private String updatedAt; // ISO 8601 Zeitstempel
}
