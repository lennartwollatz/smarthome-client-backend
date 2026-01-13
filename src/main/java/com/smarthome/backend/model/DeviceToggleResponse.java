package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

/**
 * Antwort nach dem Umschalten eines Geräts (Ein/Aus).
 */
@Data
public class DeviceToggleResponse {
    private String id;
    
    @SerializedName("isOn")
    private Boolean isOn;
}
