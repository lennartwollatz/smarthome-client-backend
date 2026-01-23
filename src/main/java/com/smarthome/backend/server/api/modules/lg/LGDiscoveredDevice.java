package com.smarthome.backend.server.api.modules.lg;

/**
 * Repräsentiert ein entdecktes LG-TV-Gerät (z. B. über mDNS oder SSDP).
 * Dient als Zwischenmodell ähnlich wie HeosDiscoveredDevice im Denon-Modul.
 */
public class LGDiscoveredDevice {

    private final String id;
    private final String name;
    private final String address;
    private final String serviceType;
    private final String manufacturer;
    private final String integrator;
    private final String macAddress;

    public LGDiscoveredDevice(String id,
                              String name,
                              String address,
                              String serviceType,
                              String manufacturer,
                              String integrator,
                              String macAddress) {
        this.id = id;
        this.name = name;
        this.address = address;
        this.serviceType = serviceType;
        this.manufacturer = manufacturer;
        this.integrator = integrator;
        this.macAddress = macAddress;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getAddress() {
        return address;
    }

    public String getServiceType() {
        return serviceType;
    }

    public String getManufacturer() {
        return manufacturer;
    }

    public String getIntegrator() {
        return integrator;
    }

    public String getMacAddress() {
        return macAddress;
    }

    
}

 