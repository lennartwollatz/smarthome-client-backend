package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;
import java.util.List;

/**
 * Repräsentiert einen Workflow mit allen Knoten und deren Konfigurationen.
 */
@Data
public class Workflow {
    private List<Node> nodes;
    
    @SerializedName("startNodeId")
    private String startNodeId;
}
