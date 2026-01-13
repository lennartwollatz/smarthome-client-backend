package com.smarthome.backend.model;

import com.smarthome.backend.model.devices.Device;
import lombok.Data;

/**
 * Antwort nach einem Pairing-Versuch eines Geräts.
 */
@Data
public class PairingResponse {
    private Boolean success;
    private Device device; // Optional, nur bei erfolgreichem Pairing
    private String error; // Optional, nur bei fehlgeschlagenem Pairing
}
