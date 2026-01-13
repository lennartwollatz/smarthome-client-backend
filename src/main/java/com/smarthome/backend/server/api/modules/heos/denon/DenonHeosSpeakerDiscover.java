package com.smarthome.backend.server.api.modules.heos.denon;

import com.smarthome.backend.server.api.modules.heos.HeosDiscover;

/**
 * mDNS-basierte Geräteerkennung für Denon HEOS-Geräte.
 * Diese Klasse erweitert HeosDiscover und setzt den Denon-spezifischen mDNS-Service-Typ.
 */
public class DenonHeosSpeakerDiscover extends HeosDiscover {
    
    /**
     * Konstruktor.
     */
    public DenonHeosSpeakerDiscover() {
        super("Denon");
    }
    
}

