package com.smarthome.backend.model;

import java.util.List;

import com.google.gson.annotations.SerializedName;

import lombok.Data;

/**
 * Repräsentiert einen Knoten im Workflow mit Typ, Konfiguration und Verbindungen.
 */
@Data
public class Node {
    @SerializedName("nodeId")
    private String nodeId;
    
    private String type; // 'action' | 'condition' | 'loop' | 'wait' | 'trigger'
    private Integer order;
    private String name;
    private Position position; // Optional
    
    @SerializedName("triggerConfig")
    private TriggerConfig triggerConfig; // Optional
    
    @SerializedName("actionConfig")
    private ActionConfig actionConfig; // Optional
    
    @SerializedName("conditionConfig")
    private ConditionConfig conditionConfig; // Optional
    
    @SerializedName("waitConfig")
    private WaitConfig waitConfig; // Optional
    
    @SerializedName("loopConfig")
    private LoopConfig loopConfig; // Optional
    
    @SerializedName("loopNodes")
    private List<String> loopNodes; // Optional, IDs der Nodes, die in der Loop ausgeführt werden sollen
    
    @SerializedName("nextNodes")
    private List<String> nextNodes; // Optional
    
    @SerializedName("trueNodes")
    private List<String> trueNodes; // Optional
    
    @SerializedName("falseNodes")
    private List<String> falseNodes; // Optional
}
