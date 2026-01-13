package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

/**
 * Request-Objekt für das Pairing eines Geräts.
 */
@Data
public class PairingRequest {
    @SerializedName("pairingCode")
    private String pairingCode; // 8-stelliger Pairing-Code
}
