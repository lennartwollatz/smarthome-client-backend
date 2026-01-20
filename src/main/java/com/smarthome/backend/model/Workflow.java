package com.smarthome.backend.model;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.annotations.SerializedName;

import lombok.Data;

/**
 * Repräsentiert einen Workflow mit allen Knoten und deren Konfigurationen.
 */
@Data
public class Workflow {
    private List<Node> nodes;
    
    @SerializedName("startNodeId")
    private String startNodeId;
    private transient Logger logger = LoggerFactory.getLogger(Workflow.class);

    public Node getTriggerNode(){
        for(Node node : nodes) {
            if(node.getType().equals("trigger")) {
                return node;
            }
        }
        logger.warn("No trigger node found");
        return null;
    }
}
