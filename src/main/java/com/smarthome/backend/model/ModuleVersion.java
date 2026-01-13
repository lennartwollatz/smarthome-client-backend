package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

/**
 * Versionsinformationen für ein Modul (erweitert VersionInfo).
 */
@Data
public class ModuleVersion {
    @SerializedName("currentVersion")
    private String currentVersion;
    
    @SerializedName("latestVersion")
    private String latestVersion;
    
    @SerializedName("hasUpdate")
    private Boolean hasUpdate;
    
    @SerializedName("supportedFrontendVersion")
    private String supportedFrontendVersion; // Optional
}
