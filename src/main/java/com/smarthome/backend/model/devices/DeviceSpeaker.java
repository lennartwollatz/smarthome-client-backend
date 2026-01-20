package com.smarthome.backend.model.devices;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.smarthome.backend.model.devices.helper.DeviceListenerPair;
import com.smarthome.backend.model.devices.helper.DeviceType;

/**
 * Repräsentiert einen Speaker (Lautsprecher) im Smart Home System.
 * Erbt von Device und setzt den Typ automatisch auf "speaker".
 */
public abstract class DeviceSpeaker extends Device {
    
    /**
     * Enum für den Wiedergabestatus des Speakers.
     */
    public static enum PlayState {
        PLAY("play"),
        PAUSE("pause"),
        STOP("stop");
        
        private final String value;
        
        PlayState(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
        
        /**
         * Konvertiert einen String-Wert in das entsprechende PlayState-Enum.
         * 
         * @param value Der String-Wert ("play", "pause" oder "stop")
         * @return Das entsprechende PlayState-Enum oder null, wenn der Wert nicht erkannt wird
         */
        public static PlayState fromString(String value) {
            if (value == null) {
                return null;
            }
            for (PlayState state : PlayState.values()) {
                if (state.value.equals(value)) {
                    return state;
                }
            }
            return null;
        }
    }
    
    /**
     * Enum für die Trigger-Funktionsnamen des Speakers.
     */
    public static enum TriggerFunctionName {
        ON_VOLUME_CHANGED("onVolumeChanged"),
        ON_VOLUME_LESS("onVolumeLess(int)"),
        ON_VOLUME_GREATER("onVolumeGreater(int)"),
        ON_VOLUME_REACHES("onVolumeReaches(int)"),
        ON_PLAY("onPlay"),
        ON_STOP("onStop"),
        ON_MUTE("onMute"),
        ON_PAUSE("onPause"),
        ON_NEXT("onNext"),
        ON_PREVIOUS("onPrevious");
        
        private final String value;
        
        TriggerFunctionName(String value) {
            this.value = value;
        }

        private static boolean hasValue(String triggerName) {
            return Arrays.stream(TriggerFunctionName.values()).anyMatch(trigger -> trigger.getValue().equals(triggerName));
        }
        
        public String getValue() {
            return value;
        }
    }
    
    /**
     * Enum für die Action-Funktionsnamen des Speakers.
     */
    public static enum ActionFunctionName {
        SET_VOLUME("setVolume(int)"),
        PLAY("play"),
        PAUSE("pause"),
        STOPP("stopp"),
        SET_MUTE("setMute"),
        PLAY_NEXT("playNext"),
        PLAY_PREVIOUS("playPrevious"),
        PLAY_SOUND("playSound(string)"),
        PLAY_TEXT_AS_SOUND("playTextAsSound(string)");
        
        private final String value;
        
        ActionFunctionName(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
    }
    
    /**
     * Enum für die Bool-Funktionsnamen des Speakers.
     */
    public static enum BoolFunctionName {
        IS_PLAYING("isPlaying"),
        IS_PAUSING("isPausing"),
        IS_STOPPED("isStopped"),
        IS_VOLUME_GREATER("isVolumeGreater(int)"),
        IS_VOLUME_LESS("isVolumeLess(int)"),
        IS_VOLUME("isVolume(int)");
        
        private final String value;
        
        BoolFunctionName(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
    }
    
    // Klassenattribute für häufig verwendete Properties
    protected String playState;
    protected Integer volume;
    protected Boolean muted;
    
    /**
     * Standard-Konstruktor.
     * Setzt den Typ automatisch auf "speaker" und initialisiert die functionsBool-Liste.
     */
    public DeviceSpeaker() {
        super();
        setType(DeviceType.SPEAKER);
        setIcon("&#128266;");
        setTypeLabel("deviceType.speaker");
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }
    
    /**
     * Konstruktor mit Name und ID.
     * 
     * @param name Der Name des Speakers
     * @param id Die eindeutige ID des Speakers
     */
    public DeviceSpeaker(String name, String id) {
        super();
        setName(name);
        setId(id);
        setType(DeviceType.SPEAKER);
        setIcon("&#128266;");
        setTypeLabel("deviceType.speaker");
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    public abstract void updateValues();
    
    /**
     * Initialisiert die Liste der booleschen Funktionen für den Speaker.
     */
    protected void initializeFunctionsBool() {
        List<String> functions = new ArrayList<>();
        functions.add(BoolFunctionName.IS_PLAYING.getValue());
        functions.add(BoolFunctionName.IS_PAUSING.getValue());
        functions.add(BoolFunctionName.IS_STOPPED.getValue());
        functions.add(BoolFunctionName.IS_VOLUME_GREATER.getValue());
        functions.add(BoolFunctionName.IS_VOLUME_LESS.getValue());
        functions.add(BoolFunctionName.IS_VOLUME.getValue());
        setFunctionsBool(functions);
    }
    
    /**
     * Initialisiert die Liste der Action-Funktionen für den Speaker.
     */
    protected void initializeFunctionsAction() {
        List<String> functions = new ArrayList<>();
        functions.add(ActionFunctionName.SET_VOLUME.getValue());
        functions.add(ActionFunctionName.PLAY.getValue());
        functions.add(ActionFunctionName.PAUSE.getValue());
        functions.add(ActionFunctionName.STOPP.getValue());
        functions.add(ActionFunctionName.SET_MUTE.getValue());
        functions.add(ActionFunctionName.PLAY_NEXT.getValue());
        functions.add(ActionFunctionName.PLAY_PREVIOUS.getValue());
        functions.add(ActionFunctionName.PLAY_SOUND.getValue());
        functions.add(ActionFunctionName.PLAY_TEXT_AS_SOUND.getValue());
        setFunctionsAction(functions);
    }
    
    /**
     * Initialisiert die Liste der Trigger-Funktionen für den Speaker.
     */
    protected void initializeFunctionsTrigger() {
        List<String> functions = new ArrayList<>();
        functions.add(TriggerFunctionName.ON_VOLUME_CHANGED.getValue());
        functions.add(TriggerFunctionName.ON_VOLUME_LESS.getValue());
        functions.add(TriggerFunctionName.ON_VOLUME_GREATER.getValue());
        functions.add(TriggerFunctionName.ON_PLAY.getValue());
        functions.add(TriggerFunctionName.ON_STOP.getValue());
        functions.add(TriggerFunctionName.ON_MUTE.getValue());
        functions.add(TriggerFunctionName.ON_PAUSE.getValue());
        functions.add(TriggerFunctionName.ON_NEXT.getValue());
        functions.add(TriggerFunctionName.ON_PREVIOUS.getValue());
        setFunctionsTrigger(functions);
    }
    
    
    /**
     * Prüft, ob der Speaker gerade spielt.
     * 
     * @return true wenn der Speaker spielt, false sonst
     */
    public boolean isPlaying() {
        return playState == PlayState.PLAY.getValue();
    }
    
    /**
     * Prüft, ob der Speaker pausiert ist.
     * 
     * @return true wenn der Speaker pausiert ist, false sonst
     */
    public boolean isPausing() {
        return playState == PlayState.PAUSE.getValue();
    }
    
    /**
     * Prüft, ob der Speaker gestoppt ist.
     * 
     * @return true wenn der Speaker gestoppt ist, false sonst
     */
    public boolean isStopped() {
        return playState == PlayState.STOP.getValue();
    }
    
    /**
     * Prüft, ob die Lautstärke größer als der angegebene Wert ist.
     * 
     * @param volume Der Vergleichswert für die Lautstärke
     * @return true wenn die Lautstärke größer als der Wert ist, false sonst
     */
    public boolean isVolumeGreater(int volume) {
        return this.volume != null && this.volume > volume;
    }
    
    /**
     * Prüft, ob die Lautstärke kleiner als der angegebene Wert ist.
     * 
     * @param volume Der Vergleichswert für die Lautstärke
     * @return true wenn die Lautstärke kleiner als der Wert ist, false sonst
     */
    public boolean isVolumeLess(int volume) {
        return this.volume != null && this.volume < volume;
    }
    
    /**
     * Prüft, ob die Lautstärke genau dem angegebenen Wert entspricht.
     * 
     * @param volume Der Vergleichswert für die Lautstärke
     * @return true wenn die Lautstärke dem Wert entspricht, false sonst
     */
    public boolean isVolume(int volume) {
        return this.volume != null && this.volume == volume;
    }
    
    /**
     * Setzt die Lautstärke des Speakers.
     * 
     * @param volume Die neue Lautstärke (typischerweise 0-100)
     */
    public void setVolume(int volume, boolean execute) {
        this.volume = volume;
        this.muted = volume == 0;
        if( execute ){ this.executeSetVolume(volume); }
        
        checkListener(TriggerFunctionName.ON_VOLUME_CHANGED.getValue());
        checkListener(TriggerFunctionName.ON_VOLUME_LESS.getValue());
        checkListener(TriggerFunctionName.ON_VOLUME_GREATER.getValue());
    }

    protected abstract void executeSetVolume(int volume);
    
    /**
     * Startet die Wiedergabe.
     */
    public void play(boolean execute) {
        this.playState = PlayState.PLAY.getValue();
        this.muted = false;
        if( execute ){ this.executePlay(); }
        checkListener(TriggerFunctionName.ON_PLAY.getValue());
    }

    protected abstract void executePlay();
    
    /**
     * Pausiert die Wiedergabe.
     */
    public void pause(boolean execute) {
        this.playState = PlayState.PAUSE.getValue();
        if( execute ){ this.executePause(); }
        checkListener(TriggerFunctionName.ON_PAUSE.getValue());
    }

    protected abstract void executePause();
    
    /**
     * Stoppt die Wiedergabe.
     */
    public void stopp(boolean execute) {
        this.playState = PlayState.STOP.getValue();
        if( execute ){ this.executeStopp(); }
        checkListener(TriggerFunctionName.ON_STOP.getValue());
    }

    protected abstract void executeStopp();
    
    /**
     * Schaltet die Stummschaltung ein oder aus.
     */
    public void setMute(Boolean muted, boolean execute) {
        this.muted = muted;
        if( execute ){ this.executeSetMute(muted); }
        checkListener(TriggerFunctionName.ON_MUTE.getValue());
    }

    protected abstract void executeSetMute(Boolean muted);
    
    /**
     * Spielt den nächsten Titel ab.
     */
    public void playNext() {
        // Implementierung für nächsten Titel
        // Der tatsächliche Befehl würde über das entsprechende Modul gesendet werden
        this.play(true);
        this.executePlayNext();
        checkListener(TriggerFunctionName.ON_NEXT.getValue());
    }

    protected abstract void executePlayNext();
    
    /**
     * Spielt den vorherigen Titel ab.
     */
    public void playPrevious() {
        // Implementierung für vorherigen Titel
        // Der tatsächliche Befehl würde über das entsprechende Modul gesendet werden
        this.play(true);
        this.executePlayPrevious();
        checkListener(TriggerFunctionName.ON_PREVIOUS.getValue());
    }

    protected abstract void executePlayPrevious();
    
    /**
     * Spielt einen Sound ab.
     * 
     * @param sound Der Name oder Pfad des Sounds
     */
    public void playSound(String sound) {
        // Implementierung für Sound-Wiedergabe
        // Der tatsächliche Befehl würde über das entsprechende Modul gesendet werdenthis.setOn();
        this.play(true);
        this.executePlaySound(sound);
    }

    protected abstract void executePlaySound(String sound);
    
    /**
     * Spielt Text als Sound ab (Text-to-Speech).
     * 
     * @param text Der Text, der als Sound abgespielt werden soll
     */
    public void playTextAsSound(String text) {
        // Implementierung für Text-to-Speech
        // Der tatsächliche Befehl würde über das entsprechende Modul gesendet werden
        this.play( true );
        this.executePlayTextAsSound(text);
    }

    protected abstract void executePlayTextAsSound(String text);
    

    @Override
    protected void checkListener(String triggerName) {
        super.checkListener(triggerName);
        if( triggerName == null || triggerName.isEmpty() || ! TriggerFunctionName.hasValue(triggerName) ) {
            return;
        }
        List<DeviceListenerPair> listeners = triggerListeners.get(triggerName);
        if (listeners == null || listeners.isEmpty()) {
            return;
        }

        if(TriggerFunctionName.ON_VOLUME_CHANGED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.ON_VOLUME_LESS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && isVolumeLess(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.ON_VOLUME_GREATER.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                    Integer threshold = pair.getParams().getParam1AsInt();
                    return threshold != null && isVolumeGreater(threshold);
                }).forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.ON_PLAY.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.ON_STOP.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.ON_MUTE.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.ON_PAUSE.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.ON_NEXT.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.ON_PREVIOUS.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
    }
}

