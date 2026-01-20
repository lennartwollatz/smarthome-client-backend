package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;
import java.util.List;
import java.util.Map;

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
    
    /**
     * Modulspezifische Daten als Key-Value-Map.
     * Kann für verschiedene Zwecke verwendet werden, z.B.:
     * - Hue: Liste gefundener Bridges
     * - Denon: Konfigurationsdaten
     * - Matter: Pairing-Informationen
     * 
     * Die Struktur ist flexibel und kann je nach Modul unterschiedlich sein.
     */
    @SerializedName("moduleData")
    private Map<String, Object> moduleData; // Optional
}
