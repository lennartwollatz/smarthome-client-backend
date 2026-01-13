package com.smarthome.backend.server.api.modules.heos;
/**
 * Repräsentiert ein entdecktes Denon HEOS-Gerät.
 */
public class HeosDiscoveredDevice {
    private String udn;
    private String friendlyName;
    private String modelName;
    private String modelNumber;
    private String deviceId;
    private String wlanMac;
    private String address;
    
    // mDNS-basierte Eigenschaften
    private String ipv4Address;
    private String ipv6Address;
    private int port;
    private String mdnsName;
    private String firmwareVersion; // fv
    private String serialNumber;
    private String manufacturer;
    
    // Player-Informationen
    private String ipAddress;
    private int pid;
    private String name;
    
    public HeosDiscoveredDevice(String udn, String friendlyName, String modelName, 
                                String modelNumber, String deviceId, String wlanMac, 
                                String address) {
        this.udn = udn;
        this.friendlyName = friendlyName;
        this.modelName = modelName;
        this.modelNumber = modelNumber;
        this.deviceId = deviceId;
        this.wlanMac = wlanMac;
        this.address = address;
        this.ipAddress = null;
        this.pid = 0;
        this.name = null;
    }
    
    // Getters
    public String getUdn() { return udn; }
    public String getFriendlyName() { return friendlyName; }
    public String getModelName() { return modelName; }
    public String getModelNumber() { return modelNumber; }
    public String getDeviceId() { return deviceId; }
    public String getWlanMac() { return wlanMac; }
    public String getAddress() { return address; }
    
    // mDNS-basierte Getter
    public String getIpv4Address() { return ipv4Address; }
    public String getIpv6Address() { return ipv6Address; }
    public int getPort() { return port; }
    public String getMdnsName() { return mdnsName; }
    public String getFirmwareVersion() { return firmwareVersion; }
    public String getSerialNumber() { return serialNumber; }
    public String getManufacturer() { return manufacturer; }
    
    // Player-Informationen Getter
    public String getIpAddress() { return ipAddress; }
    public int getPid() { return pid; }
    public String getName() { return name; }
    
    // Setters
    public void setAddress(String address) { 
        this.address = address;
    }
    
    // mDNS-basierte Setter
    public void setIpv4Address(String ipv4Address) { this.ipv4Address = ipv4Address; }
    public void setIpv6Address(String ipv6Address) { this.ipv6Address = ipv6Address; }
    public void setPort(int port) { this.port = port; }
    public void setMdnsName(String mdnsName) { this.mdnsName = mdnsName; }
    public void setFirmwareVersion(String firmwareVersion) { this.firmwareVersion = firmwareVersion; }
    public void setSerialNumber(String serialNumber) { this.serialNumber = serialNumber; }
    public void setManufacturer(String manufacturer) { this.manufacturer = manufacturer; }
    
    // Player-Informationen Setter
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public void setPid(int pid) { this.pid = pid; }
    public void setName(String name) { this.name = name; }
    
    /**
     * Gibt die beste verfügbare Adresse für Verbindungen zurück.
     * Bevorzugt IPv4, verwendet IPv6 als Fallback.
     * Entfernt eckige Klammern von IPv6-Adressen.
     * 
     * @return Die beste verfügbare Adresse (IPv4 bevorzugt, dann IPv6, dann address)
     */
    public String getBestConnectionAddress() {
        // Bevorzuge IPv4
        if (ipv4Address != null && !ipv4Address.isEmpty()) {
            return ipv4Address;
        }
        
        // Fallback auf IPv6 (entferne eckige Klammern falls vorhanden)
        if (ipv6Address != null && !ipv6Address.isEmpty()) {
            String cleaned = ipv6Address.trim();
            // Entferne eckige Klammern [ ] falls vorhanden
            if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
                cleaned = cleaned.substring(1, cleaned.length() - 1);
            }
            return cleaned;
        }
        
        // Fallback auf ipAddress (aus Player-Info)
        if (ipAddress != null && !ipAddress.isEmpty()) {
            return ipAddress;
        }
        
        // Fallback auf address
        if (address != null && !address.isEmpty()) {
            // Entferne auch hier eckige Klammern falls vorhanden
            String cleaned = address.trim();
            if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
                cleaned = cleaned.substring(1, cleaned.length() - 1);
            }
            return cleaned;
        }
        
        return null;
    }
}

