package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;
import java.util.List;

/**
 * Repräsentiert einen Knoten im Workflow mit Typ, Konfiguration und Verbindungen.
 */
@Data
public class Node {
    @SerializedName("nodeId")
    private String nodeId;
    
    private String type; // 'action' | 'condition' | 'loop' | 'wait' | 'trigger'
    private Integer order;
    private Position position; // Optional
    
    @SerializedName("triggerConfig")
    private TriggerConfig triggerConfig; // Optional
    
    @SerializedName("actionConfig")
    private ActionConfig actionConfig; // Optional
    
    @SerializedName("conditionConfig")
    private ConditionConfig conditionConfig; // Optional
    
    @SerializedName("waitConfig")
    private WaitConfig waitConfig; // Optional
    
    @SerializedName("nextNodes")
    private List<String> nextNodes; // Optional
    
    @SerializedName("trueNodes")
    private List<String> trueNodes; // Optional
    
    @SerializedName("falseNodes")
    private List<String> falseNodes; // Optional
}
