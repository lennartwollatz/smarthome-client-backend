package com.smarthome.backend.server.api.modules.hue;

import java.util.List;

/**
 * Repräsentiert eine gefundene Hue Bridge mit ihren Eigenschaften und verbundenen Geräten.
 */
public class HueDiscoveredBridge {
    private String bridgeId;
    private String name;
    private String ipAddress;
    private String ipv4Address;
    private String ipv6Address;
    private int port;
    private String modelId;
    private String manufacturer;
    private String swVersion;
    private String apiVersion;
    private String macAddress;
    private String mdnsName;
    private String friendlyName;
    
    // Pairing-Informationen
    private Boolean isPaired;
    private String username; // Username (hue-application-key) nach erfolgreichem Pairing
    private String clientKey; // Client-Key für verschlüsselte Kommunikation
    
    // IDs der Geräte, die mit der Bridge verbunden sind
    // Die Geräte selbst sind in der Datenbank für Geräte gespeichert
    private List<String> devices;
    
    public HueDiscoveredBridge(String bridgeId, String name, String ipAddress) {
        this.bridgeId = bridgeId;
        this.name = name;
        this.ipAddress = ipAddress;
        this.port = 80; // Standard-Port für Hue Bridges
    }
    
    public String getBridgeId() {
        return bridgeId;
    }
    
    public void setBridgeId(String bridgeId) {
        this.bridgeId = bridgeId;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public String getIpAddress() {
        return ipAddress;
    }
    
    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }
    
    public String getIpv4Address() {
        return ipv4Address;
    }
    
    public void setIpv4Address(String ipv4Address) {
        this.ipv4Address = ipv4Address;
    }
    
    public String getIpv6Address() {
        return ipv6Address;
    }
    
    public void setIpv6Address(String ipv6Address) {
        this.ipv6Address = ipv6Address;
    }
    
    public int getPort() {
        return port;
    }
    
    public void setPort(int port) {
        this.port = port;
    }
    
    public String getModelId() {
        return modelId;
    }
    
    public void setModelId(String modelId) {
        this.modelId = modelId;
    }
    
    public String getManufacturer() {
        return manufacturer;
    }
    
    public void setManufacturer(String manufacturer) {
        this.manufacturer = manufacturer;
    }
    
    public String getSwVersion() {
        return swVersion;
    }
    
    public void setSwVersion(String swVersion) {
        this.swVersion = swVersion;
    }
    
    public String getApiVersion() {
        return apiVersion;
    }
    
    public void setApiVersion(String apiVersion) {
        this.apiVersion = apiVersion;
    }
    
    public String getMacAddress() {
        return macAddress;
    }
    
    public void setMacAddress(String macAddress) {
        this.macAddress = macAddress;
    }
    
    public String getMdnsName() {
        return mdnsName;
    }
    
    public void setMdnsName(String mdnsName) {
        this.mdnsName = mdnsName;
    }
    
    public String getFriendlyName() {
        return friendlyName;
    }
    
    public void setFriendlyName(String friendlyName) {
        this.friendlyName = friendlyName;
    }
    
    public Boolean getIsPaired() {
        return isPaired;
    }
    
    public void setIsPaired(Boolean isPaired) {
        this.isPaired = isPaired;
    }
    
    public String getUsername() {
        return username;
    }
    
    public void setUsername(String username) {
        this.username = username;
    }
    
    public String getClientKey() {
        return clientKey;
    }
    
    public void setClientKey(String clientKey) {
        this.clientKey = clientKey;
    }
    
    public List<String> getDevices() {
        return devices;
    }
    
    public void setDevices(List<String> devices) {
        this.devices = devices;
    }

    
    /**
     * Gibt die beste verfügbare Verbindungsadresse zurück (IPv4 bevorzugt, IPv6 als Fallback).
     */
    public String getBestConnectionAddress() {
        if (ipv4Address != null && !ipv4Address.isEmpty()) {
            return ipv4Address;
        }
        if (ipv6Address != null && !ipv6Address.isEmpty()) {
            return ipv6Address;
        }
        return ipAddress;
    }
    
    /**
     * Gibt die vollständige URL für API-Zugriffe zurück.
     */
    public String getApiUrl() {
        String address = getBestConnectionAddress();
        return "http://" + address + ":" + port + "/api";
    }
    
    /**
     * Erstellt eine Kopie dieser Bridge ohne sensible Pairing-Informationen (username und clientKey).
     * Diese Methode sollte für API-Antworten verwendet werden, um sensible Daten nicht zu übertragen.
     * 
     * @return Eine Kopie der Bridge ohne username und clientKey
     */
    public HueDiscoveredBridge withoutSensitiveData() {
        HueDiscoveredBridge copy = new HueDiscoveredBridge(bridgeId, name, ipAddress);
        copy.setIpv4Address(ipv4Address);
        copy.setIpv6Address(ipv6Address);
        copy.setPort(port);
        copy.setModelId(modelId);
        copy.setManufacturer(manufacturer);
        copy.setSwVersion(swVersion);
        copy.setApiVersion(apiVersion);
        copy.setMacAddress(macAddress);
        copy.setMdnsName(mdnsName);
        copy.setFriendlyName(friendlyName);
        copy.setIsPaired(isPaired);
        // username und clientKey werden NICHT kopiert
        copy.setDevices(devices);
        return copy;
    }
    
    @Override
    public String toString() {
        return "HueDiscoveredBridge{" +
                "bridgeId='" + bridgeId + '\'' +
                ", name='" + name + '\'' +
                ", ipAddress='" + ipAddress + '\'' +
                ", ipv4Address='" + ipv4Address + '\'' +
                ", ipv6Address='" + ipv6Address + '\'' +
                ", port=" + port +
                ", swVersion='" + swVersion + '\'' +
                ", apiVersion='" + apiVersion + '\'' +
                ", isPaired=" + isPaired +
                ", username='" + (username != null ? username.substring(0, Math.min(10, username.length())) + "..." : "null") + '\'' +
                ", clientKey='" + (clientKey != null ? clientKey.substring(0, Math.min(10, clientKey.length())) + "..." : "null") + '\'' +
                ", devices=" + (devices != null ? devices.size() : 0) +
                '}';
    }
}

