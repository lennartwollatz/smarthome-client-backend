package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

/**
 * Repräsentiert einen Benutzer im System mit allen zugehörigen Informationen,
 * Einstellungen und Berechtigungen.
 */
@Data
public class User {
    private String id;
    private String name;
    private String email;
    private String role; // 'admin' | 'user' | 'guest'
    private String avatar;
    
    @SerializedName("lastActive")
    private String lastActive; // ISO 8601 Datumsstring
    
    @SerializedName("locationTrackingEnabled")
    private Boolean locationTrackingEnabled;
    
    @SerializedName("trackingToken")
    private String trackingToken;
    
    @SerializedName("pushNotificationsEnabled")
    private Boolean pushNotificationsEnabled;
    
    @SerializedName("emailNotificationsEnabled")
    private Boolean emailNotificationsEnabled;
    
    @SerializedName("smsNotificationsEnabled")
    private Boolean smsNotificationsEnabled;
    
    @SerializedName("phoneNumber")
    private String phoneNumber;
}
