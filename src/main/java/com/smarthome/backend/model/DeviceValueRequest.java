package com.smarthome.backend.model;

import lombok.Data;

/**
 * Request-Objekt für das Setzen eines Wertes für ein Gerät.
 */
@Data
public class DeviceValueRequest {
    private Double value; // z.B. Helligkeit 0-100, Temperatur in Grad Celsius
}
