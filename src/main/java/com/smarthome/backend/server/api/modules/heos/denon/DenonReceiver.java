package com.smarthome.backend.server.api.modules.heos.denon;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.annotations.Expose;
import com.smarthome.backend.model.devices.DeviceSpeakerReceiver;
import com.smarthome.backend.server.api.modules.Module;
import com.smarthome.backend.server.api.modules.heos.HeosController;
import com.smarthome.backend.server.api.modules.heos.HeosSpeaker;

/**
 * Receiver-Implementierung für Denon AVR-Geräte.
 * <p>
 * Erbt die erweiterten Speaker-Eigenschaften aus {@link DeviceSpeakerReceiver}
 * (z. B. Zonen, Subwoofer, Quellen) und implementiert die gleichen Steuer-Methoden
 * wie {@link com.smarthome.backend.server.api.modules.heos.HeosSpeaker}.
 * Die konkrete API-Kommunikation richtet sich nach den Endpunkten in {@code docs/DenonReceiverAPI}.
 */
public class DenonReceiver extends DeviceSpeakerReceiver {

    private static final Logger logger = LoggerFactory.getLogger(DenonReceiver.class);

    private String address;
    private int pid;
    @Expose(serialize = false, deserialize = false)
    private transient HeosController heos;

    /**
     * Standard-Konstruktor (z. B. für Deserialisierung).
     */
    public DenonReceiver() {
        super();
        setModuleId(Module.DENON.getModuleId());
    }

    /**
     * Konstruktor mit Pflichtfeldern.
     *
     * @param name    Anzeigename
     * @param id      eindeutige Geräte-ID
     * @param address IP-Adresse des Receivers
     */
    public DenonReceiver(String name, String id, String address, int pid, HeosController heos) {
        super(name, id);
        this.address = address;
        this.pid = pid;
        this.heos = heos;
        setModuleId(Module.DENON.getModuleId());
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public int getPid() {
        return pid;
    }

    public void setPid(int pid) {
        this.pid = pid;
    }

    public void setHeosController(HeosController heosController) {
        this.heos = heosController;
    }

    /**
     * Lädt aktuelle Werte (Power, Zonen, Quellen, Subwoofer, Lautstärkegrenzen).
     */
    @Override
    public void updateValues() {
        if (this.heos == null) {
            logger.debug("updateValues() übersprungen für {} - heos ist noch null (wird später erneut aufgerufen)", getId());
            return;
        }

        HeosSpeaker proxy = toHeosSpeaker();
        logger.debug("Initialisiere Werte für {} mit heos={}", getId(), heos != null ? "gesetzt" : "null");

        this.heos.getVolume(proxy).thenAccept(currentVolume -> {
            super.volume = currentVolume;
        }).exceptionally(e -> {
            logger.error("Fehler beim Initialisieren der Lautstärke für {}", getId(), e);
            return null;
        });

        this.heos.getMute(proxy).thenAccept(isMuted -> {
            super.muted = isMuted;
        }).exceptionally(e -> {
            logger.error("Fehler beim Initialisieren des Muted Attributs für {}", getId(), e);
            return null;
        });

        this.heos.getPlayState(proxy).thenAccept(currentPlayState -> {
            super.playState = currentPlayState;
        }).exceptionally(e -> {
            logger.error("Fehler beim Initialisieren des PlayState für {}", getId(), e);
            return null;
        });

        this.heos.getDenonZones(this).thenAccept(zones -> {
            super.zones = zones;
        }).exceptionally(e -> {
            logger.error("Fehler beim Initialisieren der Zonen für {}", getId(), e);
            return null;
        });

        this.heos.getDenonSourcesList(this).thenAccept(sources -> {
            super.sources = sources;
        }).exceptionally(e -> {
            logger.error("Fehler beim Initialisieren der Quellen für {}", getId(), e);
            return null;
        });

        this.heos.getDenonSubwoofers(this).thenAccept(subwoofers -> {
            super.subwoofers = subwoofers;
        }).exceptionally(e -> {
            logger.error("Fehler beim Initialisieren der Subwoofer für {}", getId(), e);
            return null;
        });

        this.heos.getDenonVolumeConfig(this).thenAccept(volumeConfig -> {
            super.volumeStart = volumeConfig[0];
            super.volumeMax = volumeConfig[1];
        }).exceptionally(e -> {
            logger.error("Fehler beim Initialisieren der Lautstärke-Konfiguration für {}", getId(), e);
            return null;
        });
        
    }

    @Override
    protected void executeSetVolume(int volume) {
        heos.setVolume(toHeosSpeaker(), volume);
    }

    @Override
    protected void executePlay() {
        logger.info("player play");
        heos.setPlayState(toHeosSpeaker(), "play");
    }

    @Override
    protected void executePause() {
        heos.setPlayState(toHeosSpeaker(), "pause");
    }

    @Override
    protected void executeStopp() {
        heos.setPlayState(toHeosSpeaker(), "stop");
    }

    @Override
    protected void executeSetMute(Boolean muted) {
        heos.setMute(toHeosSpeaker(), muted);
    }

    @Override
    protected void executePlayNext() {
        heos.playNext(toHeosSpeaker());
    }

    @Override
    protected void executePlayPrevious() {
        heos.playPrevious(toHeosSpeaker());
    }

    @Override
    protected void executePlaySound(String sound) {
        heos.playSong(toHeosSpeaker(), sound);
    }

    @Override
    protected void executePlayTextAsSound(String text) {
        heos.playTextAsSpeech(toHeosSpeaker(), text);
    }

    @Override
    protected void executeSetSubwooferPower(String subwooferName, boolean power) {
        heos.setDenonSubwooferPower(this, power);
    }

    @Override
    protected void executeSetSubwooferLevel(String subwooferName, Integer level) {
        heos.setDenonSubwooferLevel(this, subwooferName, level);
    }

    @Override
    protected void executeSetVolumeStart(Integer volumeStart) {
        heos.setDenonVolumeStart(this, volumeStart);
    }

    @Override
    protected void executeSetVolumeMax(Integer volumeMax) {
        heos.setDenonVolumeMax(this, volumeMax);
    }

    @Override
    protected void executeSetZonePower(String zoneName, boolean power) {
        heos.setDenonZonePower(this, zoneName, power);
    }

    @Override
    protected void executeSetSource(String sourceIndex, boolean selected) {
        if (selected) {
            heos.setDenonSource(this, sourceIndex, true);
        }
    }

    private HeosSpeaker toHeosSpeaker() {
        return new HeosSpeaker(getName(), getId(), address, pid, heos) {};
    }
}


