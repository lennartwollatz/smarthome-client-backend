package com.smarthome.backend.model;

import lombok.Data;
import java.util.List;

/**
 * Repräsentiert einen Raum im Grundriss mit Position, Größe und Eigenschaften.
 */
@Data
public class Room {
    private String id;
    private String name;
    private String icon;
    private Double x;
    private Double y;
    private Double width;
    private Double height;
    private String color; // rgba() Format
    private Double temperature; // Optional, null möglich
    private List<Point> points; // Optional, null möglich
}
