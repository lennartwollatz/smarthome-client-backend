package com.smarthome.backend.model;

import lombok.Data;

/**
 * Antwort nach dem Setzen eines Wertes für ein Gerät.
 */
@Data
public class DeviceValueResponse {
    private String id;
    private Double value; // z.B. Helligkeit 0-100, Temperatur in Grad Celsius
}
