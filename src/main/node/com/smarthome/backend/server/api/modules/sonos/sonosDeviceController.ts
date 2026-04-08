import { createRequire } from "node:module";
import { logger } from "../../../../logger.js";
import { DeviceSpeaker } from "../../../../model/devices/DeviceSpeaker.js";
import { DeviceSpeakerReceiver } from "../../../../model/devices/DeviceSpeakerReceiver.js";
import { SonosSpeaker } from "./devices/sonosSpeaker.js";
import { SonosEvent } from "./sonosEvent.js";
import { ModuleDeviceControllerEvent } from "../moduleDeviceControllerEvent.js";
const require = createRequire(import.meta.url);
const Sonos = require('sonos').Sonos;

export class SonosDeviceController extends ModuleDeviceControllerEvent<SonosEvent, SonosSpeaker> {
  private connections = new Map<string, InstanceType<typeof Sonos>>();
  private eventHandlers = new Map<string, Map<string, (arg:any) => void>>();

  public async setVolume(speaker: SonosSpeaker, volume: number) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    try {
      // Volume sollte zwischen 0 und 100 sein
      const clampedVolume = Math.max(0, Math.min(100, volume));
      await conn.setVolume(clampedVolume);
    } catch (err) {
      logger.error({ err, address: speaker.address }, "Fehler beim Setzen der Lautstaerke");
      // Fehler nicht weiterwerfen, Server soll nicht abstürzen
    }
  }

  public async getVolume(speaker: SonosSpeaker): Promise<number> {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    try {
      const volume = await conn.getVolume();
      return typeof volume === "number" ? volume : 0;
    } catch (err) {
      logger.error({ err, address: speaker.address }, "Fehler beim Abrufen der Lautstaerke");
      return 0;
    }
  }

  public async setPlayState(speaker: SonosSpeaker, state: string): Promise<boolean> {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    try {
      if (state === "play") {
        await conn.play();
      } else if (state === "pause") {
        await conn.pause();
      } else if (state === "stop") {
        await conn.stop();
      }
      return true;
    } catch (err) {
      logger.error({ err, address: speaker.address, state }, "Fehler beim Setzen des Wiedergabestatus");
      return false;
    }
  }

  public async getPlayState(speaker: SonosSpeaker): Promise<string> {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    try {
      const state = await conn.getCurrentState();
      return state ?? "stop";
    } catch (err) {
      logger.error({ err, address: speaker.address }, "Fehler beim Abrufen des Wiedergabestatus");
      return "stop";
    }
  }

  public async playSong(speaker: SonosSpeaker, url: string) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    try {
      await conn.play(url);
    } catch (err) {
      logger.error({ err, address: speaker.address, url }, "Fehler beim Abspielen eines Songs");
      // Fehler nicht weiterwerfen, Server soll nicht abstürzen
    }
  }

  public async playTextAsSpeech(speaker: SonosSpeaker, text: string) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    try {
      // Verwende TTS-Service (z.B. Google TTS oder ähnlich)
      // Für jetzt einfach als URL abspielen
      const ttsUrl = `http://translate.google.com/translate_tts?ie=UTF-8&tl=de&client=tw-ob&q=${encodeURIComponent(text)}`;
      await conn.play(ttsUrl);
    } catch (err) {
      logger.error({ err, address: speaker.address, text }, "Fehler beim Abspielen von Text als Sprache");
      // Fehler nicht weiterwerfen, Server soll nicht abstürzen
    }
  }

  public async setMute(speaker: SonosSpeaker, mute: boolean) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    try {
      await conn.setMuted(mute);
    } catch (err) {
      logger.error({ err, address: speaker.address, mute }, "Fehler beim Setzen der Stummschaltung");
      // Fehler nicht weiterwerfen, Server soll nicht abstürzen
    }
  }

  public async getMute(speaker: SonosSpeaker): Promise<boolean> {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    try {
      const muted = await conn.getMuted();
      return muted ?? false;
    } catch (err) {
      logger.error({ err, address: speaker.address }, "Fehler beim Abrufen der Stummschaltung");
      return false;
    }
  }

  public async playNext(speaker: SonosSpeaker) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    try {
      await conn.next();
    } catch (err) {
      logger.error({ err, address: speaker.address }, "Fehler beim Abspielen des naechsten Titels");
      // Fehler nicht weiterwerfen, Server soll nicht abstürzen
    }
  }

  public async playPrevious(speaker: SonosSpeaker) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    try {
      await conn.previous();
    } catch (err) {
      logger.error({ err, address: speaker.address }, "Fehler beim Abspielen des vorherigen Titels");
      // Fehler nicht weiterwerfen, Server soll nicht abstürzen
    }
  }

  public async leaveSpeakerGroup(speaker: SonosSpeaker): Promise<void> {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    try {
      await conn.leaveGroup();
    } catch (err) {
      logger.error({ err, deviceId: speaker.id, address: speaker.address }, "Sonos leaveGroup fehlgeschlagen");
      throw err;
    }
  }


  /**
   * Sonos: Koordinator ist `devices[0]`. Alle weiteren Player treten der Zone per joinGroup bei.
   */
  public async groupSpeakers(coordinator: SonosSpeaker, devices: (DeviceSpeaker | DeviceSpeakerReceiver)[]): Promise<void> {
    const sonosList = devices.filter((d): d is SonosSpeaker => d instanceof SonosSpeaker);
    if (!sonosList.length) {
      return;
    }
    const leader = sonosList[0];
    if (!leader?.id || leader.id !== coordinator.id) {
      logger.warn(
        { coordinatorId: coordinator.id, leaderId: leader?.id },
        "groupSpeakers: devices[0] muss der Koordinator sein"
      );
      return;
    }
    let zoneName = leader.roomName?.trim() ?? "";
    if (!zoneName && leader.address) {
      const leaderConn = this.getOrCreateConnection(leader.address);
      try {
        const n = await leaderConn.getName();
        zoneName = String(n ?? "").trim();
      } catch (err) {
        logger.error({ err, deviceId: leader.id }, "groupSpeakers: Konnte Zonenname nicht lesen");
        throw err;
      }
    }
    if (!zoneName) {
      throw new Error("Sonos: Kein Zonenname für den Koordinator – roomName setzen oder Gerät erreichbar machen.");
    }
    for (let i = 1; i < sonosList.length; i++) {
      const member = sonosList[i];
      if (!member?.address || member.id === leader.id) {
        continue;
      }
      const conn = this.getOrCreateConnection(member.address);
      const out = await conn.joinGroup(zoneName);
      if (out instanceof Error) {
        logger.error({ err: out, memberId: member.id, zoneName }, "Sonos joinGroup fehlgeschlagen");
        throw out;
      }
    }
  }

  public async startEventStream(device: SonosSpeaker, callback: (event: SonosEvent) => void): Promise<void> {
    const deviceId = device.id ?? "";
    if (!deviceId) {
      logger.warn("Device ID ist erforderlich für EventStreamListener");
      return;
    }
    
    const address = device.address ?? "";
    if (!address) {
      logger.warn({ deviceId }, "Keine Adresse für EventStream");
      return;
    }

    try {
      const conn = this.getOrCreateConnection(address);
      
      // Erstelle Handler für Events
      const handlers = new Map<string, (arg: any) => void>();
      
      const volumeHandler = (volume: number) => {
        logger.debug({ deviceId, volume }, "Sonos Volume Event empfangen");
        callback({
          deviceid: deviceId,
          data: {
            type: "volume",
            value: volume
          }
        });
      };
      
      const muteHandler = (muted: boolean) => {
        logger.debug({ deviceId, muted }, "Sonos Mute Event empfangen");
        callback({
          deviceid: deviceId,
          data: {
            type: "mute",
            value: muted
          }
        });
      };
      
      const stateHandler = (state: string) => {
        logger.debug({ deviceId, state }, "Sonos State Event empfangen");
        callback({
          deviceid: deviceId,
          data: {
            type: "playState",
            value: state
          }
        });
      };
      
      conn.on("Volume", volumeHandler);
      conn.on("Muted", muteHandler);
      conn.on("CurrentState", stateHandler);
      
      handlers.set("Volume", volumeHandler);
      handlers.set("Muted", muteHandler);
      handlers.set("CurrentState", stateHandler);
      
      this.eventHandlers.set(deviceId, handlers);
      logger.debug({ deviceId }, "EventStream für Sonos-Gerät gestartet");
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Starten des EventStreamListeners");
      // Fehler nicht weiterwerfen, Server soll nicht abstürzen
    }
  }

  public async stopEventStream(device: SonosSpeaker): Promise<void> {
    const deviceId = device.id ?? "";
    if (!deviceId) {
      return;
    }
    
    const handlers = this.eventHandlers.get(deviceId);
    if (handlers) {
      const address = device.address ?? "";
      if (address) {
        const conn = this.connections.get(address);
        if (conn) {
          // Entferne Event-Handler
          handlers.forEach((handler, eventName) => {
            conn.off(eventName, handler);
          });
        }
      }
      handlers.clear();
      this.eventHandlers.delete(deviceId);
      logger.debug({ deviceId }, "EventStreamListener entfernt");
    }
  }

  private getOrCreateConnection(address: string) {
    if (!this.connections.has(address)) {
      const conn = new Sonos(address);
      this.connections.set(address, conn);
    }
    return this.connections.get(address)!;
  }

  disconnectAll() {
    for (const connection of this.connections.values()) {
      try {
        connection.removeAllListeners();
      } catch (err) {
        logger.warn({ err }, "Fehler beim Entfernen von Event-Listenern");
      }
    }
    this.connections.clear();
    this.eventHandlers.clear();
  }
}

