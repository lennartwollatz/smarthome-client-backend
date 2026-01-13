package com.smarthome.backend.model;

import lombok.Data;

/**
 * Zeitfenster für automatische Updates.
 */
@Data
public class UpdateTimes {
    private String from; // Format HH:mm (24-Stunden-Format)
    private String to;   // Format HH:mm (24-Stunden-Format)
}
