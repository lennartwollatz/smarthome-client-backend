package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

/**
 * Versionsinformationen für eine Komponente (Frontend, Backend oder Modul).
 */
@Data
public class VersionInfo {
    @SerializedName("currentVersion")
    private String currentVersion;
    
    @SerializedName("latestVersion")
    private String latestVersion;
    
    @SerializedName("hasUpdate")
    private Boolean hasUpdate;
    
    @SerializedName("supportedFrontendVersion")
    private String supportedFrontendVersion; // Optional, nur bei Modulen
}
