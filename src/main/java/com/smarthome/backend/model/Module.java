package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;
import java.util.List;

/**
 * Repräsentiert ein Modul, das Geräte und Funktionen bereitstellt.
 */
@Data
public class Module {
    private String id;
    private String name;
    
    @SerializedName("shortDescription")
    private String shortDescription;
    
    @SerializedName("longDescription")
    private String longDescription; // Optional
    
    private String icon;
    
    @SerializedName("categoryKey")
    private String categoryKey; // 'lighting' | 'climate' | 'household' | 'mobility' | 'calendar' | 'audioTv' | 'assistant' | 'delivery' | 'services'
    
    @SerializedName("isInstalled")
    private Boolean isInstalled;
    
    @SerializedName("isActive")
    private Boolean isActive;
    
    private Double price;
    private List<String> features;
    private ModuleVersion version;
    
    @SerializedName("isPurchased")
    private Boolean isPurchased; // Optional
    
    @SerializedName("isDisabled")
    private Boolean isDisabled; // Optional
    
    private List<String> devices; // Optional
}
