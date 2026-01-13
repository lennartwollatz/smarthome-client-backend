package com.smarthome.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Repräsentiert eine visuelle Position im Workflow-Editor.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Position {
    private Double x;
    private Double y;
}
