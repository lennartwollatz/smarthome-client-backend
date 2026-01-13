package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

/**
 * Request-Objekt für die Änderung des Aktivierungsstatus eines Moduls.
 */
@Data
public class ModuleActiveRequest {
    @SerializedName("isActive")
    private Boolean isActive;
}
