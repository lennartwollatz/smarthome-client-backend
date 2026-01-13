package com.smarthome.backend.model.devices;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import com.smarthome.backend.model.devices.helper.DeviceListenerPair;
import com.smarthome.backend.model.devices.helper.DeviceListenerParams;
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
        ON_OFF("onOff"),
        ON_ON("onOn"),
        ON_NEXT("onNext"),
        ON_PREVIOUS("onPrevious");
        
        private final String value;
        
        TriggerFunctionName(String value) {
            this.value = value;
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
        SET_OFF("setOff"),
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
        IS_ON("isOn"),
        IS_OFF("isOff"),
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

    
    // Zentrale HashMap für Listener mit DeviceListenerParams
    private final Map<String, List<DeviceListenerPair>> triggerListeners = new HashMap<>();
    
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
        initializeValues();
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
        initializeValues();
    }

    protected abstract void initializeValues();
    
    /**
     * Initialisiert die Liste der booleschen Funktionen für den Speaker.
     */
    private void initializeFunctionsBool() {
        List<String> functions = new ArrayList<>();
        functions.add(BoolFunctionName.IS_ON.getValue());
        functions.add(BoolFunctionName.IS_OFF.getValue());
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
    private void initializeFunctionsAction() {
        List<String> functions = new ArrayList<>();
        functions.add(ActionFunctionName.SET_VOLUME.getValue());
        functions.add(ActionFunctionName.SET_OFF.getValue());
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
    private void initializeFunctionsTrigger() {
        List<String> functions = new ArrayList<>();
        functions.add(TriggerFunctionName.ON_VOLUME_CHANGED.getValue());
        functions.add(TriggerFunctionName.ON_VOLUME_LESS.getValue());
        functions.add(TriggerFunctionName.ON_VOLUME_GREATER.getValue());
        functions.add(TriggerFunctionName.ON_VOLUME_REACHES.getValue());
        functions.add(TriggerFunctionName.ON_PLAY.getValue());
        functions.add(TriggerFunctionName.ON_STOP.getValue());
        functions.add(TriggerFunctionName.ON_MUTE.getValue());
        functions.add(TriggerFunctionName.ON_PAUSE.getValue());
        functions.add(TriggerFunctionName.ON_OFF.getValue());
        functions.add(TriggerFunctionName.ON_ON.getValue());
        functions.add(TriggerFunctionName.ON_NEXT.getValue());
        functions.add(TriggerFunctionName.ON_PREVIOUS.getValue());
        setFunctionsTrigger(functions);
    }
    
    
    /**
     * Prüft, ob der Speaker eingeschaltet ist.
     * 
     * @return true wenn der Speaker eingeschaltet ist, false sonst
     */
    public boolean isOn() {
        return this.isConnected != null && this.isConnected;
    }
    
    /**
     * Prüft, ob der Speaker ausgeschaltet ist.
     * 
     * @return true wenn der Speaker ausgeschaltet ist, false sonst
     */
    public boolean isOff() {
        return !isOn();
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
    public void setVolume(int volume) {
        this.volume = volume;
        this.muted = volume == 0;
        this.executeSetVolume(volume);
        
        checkListener(TriggerFunctionName.ON_VOLUME_CHANGED);
        checkListener(TriggerFunctionName.ON_VOLUME_LESS);
        checkListener(TriggerFunctionName.ON_VOLUME_GREATER);
        checkListener(TriggerFunctionName.ON_VOLUME_REACHES);
    }

    protected abstract void executeSetVolume(int volume);
    
    /**
     * Schaltet den Speaker aus.
     */
    public void setOff() {
        this.isConnected = false;
        this.stopp();
        this.executeSetOff();
        checkListener(TriggerFunctionName.ON_OFF);
    }

    protected abstract void executeSetOff();

    /**
     * Schaltet den Speaker ein.
     */
    public void setOn() {
        this.isConnected = true;
        this.executeSetOn();
        checkListener(TriggerFunctionName.ON_ON);
    }

    protected abstract void executeSetOn();
    
    /**
     * Startet die Wiedergabe.
     */
    public void play() {
        this.playState = PlayState.PLAY.getValue();
        this.muted = false;
        this.executePlay();
        checkListener(TriggerFunctionName.ON_PLAY);
    }

    protected abstract void executePlay();
    
    /**
     * Pausiert die Wiedergabe.
     */
    public void pause() {
        this.playState = PlayState.PAUSE.getValue();
        this.executePause();
        checkListener(TriggerFunctionName.ON_PAUSE);
    }

    protected abstract void executePause();
    
    /**
     * Stoppt die Wiedergabe.
     */
    public void stopp() {
        this.playState = PlayState.STOP.getValue();
        this.executeStopp();
        checkListener(TriggerFunctionName.ON_STOP);
    }

    protected abstract void executeStopp();
    
    /**
     * Schaltet die Stummschaltung ein oder aus.
     */
    public void setMute(Boolean muted) {
        this.muted = muted;
        this.executeSetMute(muted);
        checkListener(TriggerFunctionName.ON_MUTE);
    }

    protected abstract void executeSetMute(Boolean muted);
    
    /**
     * Spielt den nächsten Titel ab.
     */
    public void playNext() {
        // Implementierung für nächsten Titel
        // Der tatsächliche Befehl würde über das entsprechende Modul gesendet werden
        this.setOn();
        this.play();
        this.executePlayNext();
        checkListener(TriggerFunctionName.ON_NEXT);
    }

    protected abstract void executePlayNext();
    
    /**
     * Spielt den vorherigen Titel ab.
     */
    public void playPrevious() {
        // Implementierung für vorherigen Titel
        // Der tatsächliche Befehl würde über das entsprechende Modul gesendet werden
        this.setOn();
        this.play();
        this.executePlayPrevious();
        checkListener(TriggerFunctionName.ON_PREVIOUS);
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
        this.play();
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
        this.play();
        this.executePlayTextAsSound(text);
    }

    protected abstract void executePlayTextAsSound(String text);
    
    /**
     * Zentrale Methode zum Registrieren von Listenern mit DeviceListenerParams.
     * 
     * @param params Die Parameter für den Listener (name, param1, param2)
     * @param listener Die Callback-Funktion, die aufgerufen wird
     */
    public void addListener(DeviceListenerParams params, Runnable listener) {
        if (params == null || params.getName() == null || listener == null) {
            return;
        }
        
        String triggerName = params.getName();
        triggerListeners.computeIfAbsent(triggerName, k -> new CopyOnWriteArrayList<>())
                       .add(new DeviceListenerPair(params, listener));
    }
    
    private void checkListener(TriggerFunctionName triggerName) {
        String triggerNameString = triggerName.getValue();
        List<DeviceListenerPair> listeners = triggerListeners.get(triggerNameString);
        if (listeners == null || listeners.isEmpty()) {
            return;
        }
        
        switch (triggerName) {
            case ON_VOLUME_CHANGED:
                listeners.forEach(pair -> { pair.run(); });
                break;
            case ON_VOLUME_LESS:
                listeners.stream().filter(pair -> {
                    Integer threshold = pair.getParams().getParam1AsInt();
                    return threshold != null && isVolumeLess(threshold);
                }).forEach(pair -> {
                    pair.run();
                });
                break;
            case ON_VOLUME_GREATER:
                listeners.stream().filter(pair -> {
                    Integer threshold = pair.getParams().getParam1AsInt();
                    return threshold != null && isVolumeGreater(threshold);
                }).forEach(pair -> {
                    pair.run();
                });
                break;
            case ON_VOLUME_REACHES:
                listeners.stream().filter(pair -> {
                    Integer targetVolume = pair.getParams().getParam1AsInt();
                    return targetVolume != null && isVolume(targetVolume);
                }).forEach(pair -> {
                    pair.run();
                });
                break;
            case ON_PLAY:
                listeners.forEach(pair -> pair.run());
                break;
            case ON_STOP:
                listeners.forEach(pair -> pair.run());
                break;
            case ON_PAUSE:
                listeners.forEach(pair -> pair.run());
                break;
            case ON_OFF:
                listeners.forEach(pair -> pair.run());
                break;
            case ON_ON:
                listeners.forEach(pair -> pair.run());
                break;
            case ON_MUTE:
                listeners.forEach(pair -> pair.run());
                break;
            case ON_NEXT:
                listeners.forEach(pair -> pair.run());
                break;
            case ON_PREVIOUS:
                listeners.forEach(pair -> pair.run());
                break;
        }
    }
}

