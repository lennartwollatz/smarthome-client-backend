package com.smarthome.backend.model;

import lombok.Data;
import java.util.List;

/**
 * Repräsentiert den vollständigen Grundriss mit allen Räumen.
 */
@Data
public class FloorPlan {
    private List<Room> rooms;
}
