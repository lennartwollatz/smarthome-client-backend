package com.smarthome.backend.server.api.modules.xiaomi;

/**
 * Repräsentiert ein entdecktes Xiaomi MiIO Gerät.
 */
public class XiaomiDiscoveredDevice {
    private String id;
    private String name;
    private String model;
    private String token;
    private String ip;
    private String mac;
    private String did;
    private String locale;
    private String status;

    public XiaomiDiscoveredDevice() {
        // Default-Konstruktor für Serialisierung/Deserialisierung
    }

    public XiaomiDiscoveredDevice(String id, String name, String model, String token, String ip, String mac,
            String did, String locale, String status) {
        this.id = id;
        this.name = name;
        this.model = model;
        this.token = token;
        this.ip = ip;
        this.mac = mac;
        this.did = did;
        this.locale = locale;
        this.status = status;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getIp() {
        return ip;
    }

    public void setIp(String ip) {
        this.ip = ip;
    }

    public String getMac() {
        return mac;
    }

    public void setMac(String mac) {
        this.mac = mac;
    }

    public String getDid() {
        return did;
    }

    public void setDid(String did) {
        this.did = did;
    }

    public String getLocale() {
        return locale;
    }

    public void setLocale(String locale) {
        this.locale = locale;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    /**
     * Gibt die beste verfügbare Adresse für Verbindungen zurück.
     */
    public String getBestConnectionAddress() {
        if (ip != null && !ip.isEmpty()) {
            return ip;
        }
        return null;
    }
}

