package com.smarthome.backend.server.api.modules.lg;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.smarthome.backend.model.devices.DeviceTV;
import com.smarthome.backend.server.api.modules.Module;

/**
 * Repräsentiert einen LG-TV als Gerät mit integrierter WebSocket-Verbindung.
 * <p>
 * Erweitert {@link DeviceTV} und integriert die Funktionalität von WebOSClient
 * direkt in die LGTV-Klasse.
 */
public class LGTV extends DeviceTV {
    private static final Logger logger = LoggerFactory.getLogger(LGTV.class);

    /**
     * Netzadresse des LG-TVs (z. B. IP-Adresse).
     */
    private final String address;

    /**
     * Client-Key für die WebOS-Registrierung (optional).
     */
    private String clientKey;

    /**
     * MAC-Adresse des LG-TVs (für Wake-on-LAN).
     */
    private String macAddress;

    /**
     * Standardkonstruktor (z. B. für Gson-Deserialisierung).
     */
    protected LGTV() {
        super();
        this.address = null;
        this.clientKey = null;
        this.macAddress = null;
        super.isConnected = clientKey != null;
        setModuleId(Module.LG.getModuleId());
    }

    /**
     * Konstruktor mit Name, ID und Adresse.
     *
     * @param name    Anzeigename des Fernsehers
     * @param id      eindeutige Geräte-ID
     * @param address IP-Adresse oder Hostname des LG-TVs
     * @param macAddress MAC-Adresse des LG-TVs
     * @param clientKey Client-Key für die WebOS-Registrierung
     */
    public LGTV(String name, String id, String address, String macAddress, String clientKey) {
        super(name, id);
        this.address = address;
        this.clientKey = clientKey;
        this.macAddress = macAddress;
        super.isConnected = clientKey != null;
        setModuleId(Module.LG.getModuleId());
        this.updateValues();
    }

    

    public void updateValues() {
        if( this.clientKey != null) {
            this.selectedApp = LGController.getSelectedApp(this);
            if(selectedApp != null) {
                this.selectedChannel = LGController.getSelectedChannel(this);
                Integer vol = LGController.getVolume(this);
                if(vol != null) {
                    this.volume = vol;
                }
            }
            
            //this.power = LGController.getPower(this);
            //this.screen = LGController.getScreen(this);
            if(this.selectedChannel != null || this.selectedApp != null) {
                this.power = true;
            } else {
                this.power = false;
            }
        }
    }

    public void updateChannels() {
        this.channels = LGController.getChannels(this);
    }

    public void updateApps() {
        this.apps = LGController.getApps(this);
    }

    public String getClientKey() {
        return clientKey;
    }


    public String getAddress() {
        return address;
    }

    public String getMacAddress() {
        return macAddress;
    }

    public void setClientKey(String clientKey) {
        this.clientKey = clientKey;
        super.isConnected = clientKey != null;
    }

    public void setMacAddress(String macAddress) {
        this.macAddress = macAddress;
    }

    public Boolean register() {
        return LGController.register(this);
    }

    @Override
    protected void executeSetPower(Boolean power) {
        if(power) {
            LGController.powerOn(this);
        } else {
            LGController.powerOff(this);
        }
    }

    @Override
    protected void executeSetScreen(Boolean screen) {
        if(screen) {
            LGController.screenOn(this);
        } else {
            LGController.screenOff(this);
        }
    }

    @Override
    protected void executeSetChannel(String channel) {
        LGController.setChannel(this, channel);
    }


    @Override
    protected void executeStartApp(String appId) {
        LGController.startApp(this, appId);
    }


    @Override
    protected void executeNotify(String message) {
        LGController.notify(this, message);
    }

    @Override
    protected void executeSetVolume(int volume) {
        LGController.setVolume(this, volume);
    }
}
