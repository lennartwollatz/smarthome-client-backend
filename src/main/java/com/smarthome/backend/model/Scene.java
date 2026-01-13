package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import java.util.List;

/**
 * Repräsentiert eine Szene, die mehrere Aktionen zusammenfasst.
 */
@Data
@Getter
@Setter
public class Scene {
    private String id;
    private String name;
    private String icon; // Optional
    private Boolean active; // Optional, Standard: false
    private String description; // Optional
    
    @SerializedName("actionIds")
    private List<String> actionIds; // Optional
}
