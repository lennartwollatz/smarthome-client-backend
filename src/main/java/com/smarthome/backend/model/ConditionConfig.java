package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;
import java.util.List;

/**
 * Konfiguration für einen Bedingungs-Knoten im Workflow.
 */
@Data
public class ConditionConfig {
    @SerializedName("deviceId")
    private String deviceId;
    
    @SerializedName("moduleId")
    private String moduleId;
    
    private String property; // z.B. 'isConnected()', 'brighterAs(int)'
    private List<Object> values; // Optional, Array von Werten, erforderlich wenn Eigenschaft Parameter hat
}
