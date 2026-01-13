package com.smarthome.backend.server.api.modules.heos;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.smarthome.backend.model.devices.DeviceSpeaker;

/**
 * Repräsentiert einen HEOS-Speaker als Gerät.
 * Erweitert DeviceSpeaker und implementiert die HEOS-spezifische Kommunikation.
 */
public abstract class HeosSpeaker extends DeviceSpeaker {
    private static final Logger logger = LoggerFactory.getLogger(HeosSpeaker.class);
    
    private String address;
    private int pid;
    @com.google.gson.annotations.Expose(serialize = false, deserialize = false)
    private transient HeosController heos;
    
    /**
     * Standardkonstruktor für Gson-Deserialisierung.
     * Wird verwendet, wenn Geräte aus der Datenbank geladen werden.
     */
    protected HeosSpeaker() {
        super();
        this.address = null;
        this.pid = 0;
        this.heos = null;
        // heos wird später gesetzt, wenn das Gerät initialisiert wird
    }
    
    /**
     * Erstellt einen neuen HeosSpeaker.
     * 
     * @param name Der Name des Speakers
     * @param id Die eindeutige ID des Speakers
     * @param address Die IP-Adresse des HEOS-Geräts
     * @param pid Die Player-ID
     * @param heos Die HeosController-Instanz für die Kommunikation
     */
    public HeosSpeaker(String name, String id, String address, int pid, HeosController heos) {
        super(name, id);
        this.address = address;
        this.pid = pid;
        
        // Prüfe, ob heos null ist
        if (heos == null) {
            logger.error("HeosController ist null beim Erstellen von HeosSpeaker {} ({})", name, id);
            throw new IllegalArgumentException("HeosController darf nicht null sein");
        }
        
        this.heos = heos;
        this.isConnected = true;
        // initializeValues() wird bereits von DeviceSpeaker-Konstruktor aufgerufen,
        // aber zu diesem Zeitpunkt ist heos noch null. Rufe es erneut auf, nachdem heos gesetzt wurde.
        this.initializeValues();
    }
    
    public String getAddress() {
        return address;
    }
    
    public int getPid() {
        return pid;
    }
    
    /**
     * Initialisiert die initialen Werte des Speakers.
     * Wird sowohl vom DeviceSpeaker-Konstruktor (wenn heos noch null ist) als auch
     * vom HeosSpeaker-Konstruktor (nachdem heos gesetzt wurde) aufgerufen.
     */
    @Override
    protected void initializeValues() {
        // Prüfe, ob heos bereits gesetzt ist
        // Wenn nicht, wird initializeValues() später erneut aufgerufen, nachdem heos gesetzt wurde
        if (this.heos == null) {
            logger.debug("initializeValues() übersprungen für {} - heos ist noch null (wird später erneut aufgerufen)", getId());
            return;
        }
        
        logger.debug("Initialisiere Werte für {} mit heos={}", getId(), heos != null ? "gesetzt" : "null");
        
        this.heos.getVolume(this).thenAccept(volume -> {
            super.volume = volume;
        }).exceptionally(e -> {
            logger.error("Fehler beim Initialisieren der Lautstärke für {}", getId(), e);
            return null;
        });

        this.heos.getMute(this).thenAccept(mute -> {
            super.muted = mute;
        }).exceptionally(e -> {
            logger.error("Fehler beim Initialisieren des Muted Attributs für {}", getId(), e);
            return null;
        });
        
        this.heos.getPlayState(this).thenAccept(playState -> {
            super.playState = playState;
        }).exceptionally(e -> {
            logger.error("Fehler beim Initialisieren des PlayState für {}", getId(), e);
            return null;
        });
    }
    
    
    /**
     * Setzt die Lautstärke über HEOS.
     */
    @Override
    protected void executeSetVolume(int volume) {
        heos.setVolume(this, volume);
    }
    
    /**
     * Schaltet den Speaker über HEOS aus.
     */
    @Override
    protected void executeSetOff() {
    }
    
    /**
     * Schaltet den Speaker über HEOS ein.
     */
    @Override
    protected void executeSetOn() {
    }
    
    /**
     * Startet die Wiedergabe über HEOS.
     */
    @Override
    protected void executePlay() {
        logger.info("player play");
        heos.setPlayState(this, "play");
    }
    
    /**
     * Pausiert die Wiedergabe über HEOS.
     */
    @Override
    protected void executePause() {
        heos.setPlayState(this, "pause");
    }
    
    /**
     * Stoppt die Wiedergabe über HEOS.
     */
    @Override
    protected void executeStopp() {
        heos.setPlayState(this, "stop");
    }
    
    /**
     * Setzt die Stummschaltung über HEOS.
     */
    @Override
    protected void executeSetMute(Boolean muted) {
        heos.setMute(this, muted);
    }
    
    /**
     * Spielt den nächsten Titel über HEOS ab.
     */
    @Override
    protected void executePlayNext() {
        heos.playNext(this);
    }
    
    /**
     * Spielt den vorherigen Titel über HEOS ab.
     */
    @Override
    protected void executePlayPrevious() {
        heos.playPrevious(this);
    }
    
    /**
     * Spielt einen Sound über HEOS ab.
     */
    @Override
    protected void executePlaySound(String sound) {
        heos.playSong(this, sound);
    }
    
    /**
     * Spielt Text als Sound über HEOS ab (Text-to-Speech).
     */
    @Override
    protected void executePlayTextAsSound(String text) {
        heos.playTextAsSpeech(this, text);
    }
    
}

