package com.smarthome.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Repräsentiert einen Punkt mit X- und Y-Koordinaten für Polygon-Formen.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Point {
    private Double x;
    private Double y;
}
