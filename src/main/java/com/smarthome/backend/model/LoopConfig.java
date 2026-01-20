package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;

import lombok.Data;

/**
 * Konfiguration für einen Loop-Knoten im Workflow.
 */
@Data
public class LoopConfig {
    private String type; // 'for' | 'while'
    
    @SerializedName("count")
    private Integer count; // Optional, Anzahl der Wiederholungen (für 'for' Typ)
    
    @SerializedName("condition")
    private ConditionConfig condition; // Optional, Condition für 'while' Typ
    
    @SerializedName("maxIterations")
    private Integer maxIterations; // Optional, Maximale Anzahl der Wiederholungen (für 'for' Typ)
    
    public String getType() {
        return type;
    }

    public Integer getCount() {
        return count;
    }

    public ConditionConfig getCondition() {
        return condition;
    }
}

