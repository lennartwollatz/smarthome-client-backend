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
}
