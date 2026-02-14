import net from "node:net";
import https from "node:https";
import { logger } from "../../../../logger.js";
import type { HeosSpeaker } from "./devices/heosSpeaker.js";
import type { DenonReceiver } from "./denon/devices/denonReceiver.js";
import { Source, Subwoofer, Zone } from "../../../../model/devices/DeviceSpeakerReceiver.js";
import { ModuleDeviceControllerEvent } from "../moduleDeviceControllerEvent.js";
import { HeosEvent } from "./heosEvent.js";
import { DeviceSpeaker } from "../../../../model/devices/DeviceSpeaker.js";

type HeosResponse = {
  command?: string;
  result?: string;
  message?: string;
  payload?: Record<string, unknown> | Array<Record<string, unknown>>;
};

export class HeosDeviceController extends ModuleDeviceControllerEvent<HeosEvent, DeviceSpeaker> {
  private eventHandlers = new Map<string, Map<string, (...args: any[]) => void>>();
  private connections = new Map<string, Connection>();

  createTemporaryConnection(address: string) {
    return new Connection(address);
  }

  async setVolume(speaker: HeosSpeaker, volume: number) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    await conn.connect();
    await conn.playerSetVolume(speaker.pid ?? 0, volume);
  }

  async getVolume(speaker: HeosSpeaker) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    await conn.connect();
    return conn.playerGetVolume(speaker.pid ?? 0);
  }

  async setPlayState(speaker: HeosSpeaker, state: string) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    await conn.connect();
    await conn.playerSetPlayState(speaker.pid ?? 0, state);
  }

  async getPlayState(speaker: HeosSpeaker) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    await conn.connect();
    return conn.playerGetPlayState(speaker.pid ?? 0);
  }

  async playSong(speaker: HeosSpeaker, url: string) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    await conn.connect();
    await conn.browsePlayStream(speaker.pid ?? 0, 0, 0, 0, url);
  }

  async playTextAsSpeech(_speaker: HeosSpeaker, _text: string) {
    return;
  }

  async setMute(speaker: HeosSpeaker, mute: boolean) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    await conn.connect();
    await conn.playerSetMute(speaker.pid ?? 0, mute);
  }

  async getMute(speaker: HeosSpeaker) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    await conn.connect();
    return conn.playerGetMute(speaker.pid ?? 0);
  }

  async playNext(speaker: HeosSpeaker) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    await conn.connect();
    await conn.playerPlayNext(speaker.pid ?? 0);
  }

  async playPrevious(speaker: HeosSpeaker) {
    const conn = this.getOrCreateConnection(speaker.address ?? "");
    await conn.connect();
    await conn.playerPlayPrevious(speaker.pid ?? 0);
  }

  disconnectAll() {
    for (const connection of this.connections.values()) {
      connection.disconnect().catch(err => {
        logger.warn({ err }, "Fehler beim Disconnect");
      });
    }
    this.connections.clear();
  }

  public async startEventStream(device: DeviceSpeaker, callback: (event: HeosEvent) => void): Promise<void> {
    const deviceId = device.id ?? "";
    if (!deviceId) {
      throw new Error("Device ID ist erforderlich für EventStreamListener");
    }
    
    const speaker = device as HeosSpeaker;
    const address = speaker.address ?? "";
    if (!address) {
      logger.warn({ deviceId }, "Keine Adresse für EventStream");
      return;
    }

    try {
      const conn = this.getOrCreateConnection(address);
      await conn.connect();
      
      // Registriere für Change Events
      await conn.systemRegisterForChangeEvents(true);
      
      // Erstelle Handler für Events
      const handlers = new Map<string, (event: Record<string, unknown>) => void>();
      
      const eventHandler = (event: Record<string, unknown>) => {
        logger.debug({ deviceId, event }, "Heos Event empfangen");
        callback({
          deviceid: deviceId,
          data: {
            type: event.command as string ?? "unknown",
            value: event
          }
        });
      };
      
      conn.onEvent(eventHandler);
      handlers.set("event", eventHandler);
      
      this.eventHandlers.set(deviceId, handlers);
      logger.debug({ deviceId }, "EventStream für Heos-Gerät gestartet");
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Starten des EventStreamListeners");
      throw err;
    }
  }

  public async stopEventStream(device: DeviceSpeaker): Promise<void> {
    const deviceId = device.id ?? "";
    if (!deviceId) {
      return;
    }
    
    const handlers = this.eventHandlers.get(deviceId);
    if (handlers) {
      const speaker = device as HeosSpeaker;
      const address = speaker.address ?? "";
      if (address) {
        const conn = this.connections.get(address);
        if (conn) {
          // Entferne Event-Handler
          handlers.forEach((handler) => {
            conn.offEvent(handler);
          });
          // Deaktiviere Change Events
          conn.systemRegisterForChangeEvents(false).catch(err => {
            logger.warn({ err, deviceId }, "Fehler beim Deaktivieren von Change Events");
          });
        }
      }
      handlers.clear();
      this.eventHandlers.delete(deviceId);
      logger.debug({ deviceId }, "EventStreamListener entfernt");
    }
  }

  async setDenonVolumeStart(_receiver: DenonReceiver, _volumeStart: number) {
    const receiver = _receiver;
    const data = `<PowerOnLevel>${_volumeStart}</PowerOnLevel>`;
    const path = `/ajax/audio/set_config?type=7&data=${this.urlEncode(data)}`;
    await this.sendDenonGet(receiver.address, path);
  }

  async setDenonVolumeMax(_receiver: DenonReceiver, _volumeMax: number) {
    const receiver = _receiver;
    const data = `<Limit>${_volumeMax}</Limit>`;
    const path = `/ajax/audio/set_config?type=7&data=${this.urlEncode(data)}`;
    await this.sendDenonGet(receiver.address, path);
  }

  async setDenonZonePower(_receiver: DenonReceiver, _zoneName: string, _power: boolean) {
    const receiver = _receiver;
    const zoneTag = this.mapZoneTag(_zoneName);
    const data = `<${zoneTag}><Power>${_power ? "1" : "0"}</Power></${zoneTag}>`;
    const path = `/ajax/globals/set_config?type=4&data=${this.urlEncode(data)}`;
    await this.sendDenonGet(receiver.address, path);
  }

  async setDenonSource(_receiver: DenonReceiver, _sourceIndex: string, _selected: boolean) {
    if (!_selected) return;
    const receiver = _receiver;
    const zoneIndex = this.mapZoneIndex(undefined);
    const data = `<Source zone="${zoneIndex}" index="${_sourceIndex}"></Source>`;
    const path = `/ajax/globals/set_config?type=7&data=${this.urlEncode(data)}`;
    await this.sendDenonGet(receiver.address, path);
  }

  async setDenonSubwooferPower(_receiver: DenonReceiver, _power: boolean) {
    const receiver = _receiver;
    const data = `<SurroundParameter><Subwoofer>${_power ? "1" : "0"}</Subwoofer></SurroundParameter>`;
    const path = `/ajax/audio/set_config?type=4&data=${this.urlEncode(data)}`;
    await this.sendDenonGet(receiver.address, path);
  }

  async setDenonSubwooferLevel(_receiver: DenonReceiver, _subwooferName: string, _level: number) {
    const receiver = _receiver;
    const levelTag = this.resolveSubwooferTag(receiver, _subwooferName);
    const data = `<${levelTag}>${_level}</${levelTag}>`;
    const path = `/ajax/audio/set_config?type=3&data=${this.urlEncode(data)}`;
    await this.sendDenonGet(receiver.address, path);
  }

  async getDenonZonePowerStatus(_receiver: DenonReceiver) {
    return this.sendDenonGet(_receiver.address, "/ajax/globals/get_config?type=4");
  }

  async getDenonSubwooferLevels(_receiver: DenonReceiver) {
    return this.sendDenonGet(_receiver.address, "/ajax/audio/get_config?type=3");
  }

  async getDenonSubwooferPowerConfig(_receiver: DenonReceiver) {
    return this.sendDenonGet(_receiver.address, "/ajax/audio/get_config?type=4");
  }

  async getDenonVolumeConfig(_receiver: DenonReceiver) {
    const xml = await this.sendDenonGet(_receiver.address, "/ajax/audio/get_config?type=7");
    return this.parseVolumeLimits(xml);
  }

  async getDenonSources(_receiver: DenonReceiver) {
    return this.sendDenonGet(_receiver.address, "/ajax/globals/get_config?type=7");
  }

  async getDenonSourcesList(_receiver: DenonReceiver) {
    const receiver = _receiver;
    let selectedIndex: string | null = null;
    if (receiver.sources) {
      for (const source of receiver.sources) {
        if (source?.selected) {
          selectedIndex = source.index ?? null;
          break;
        }
      }
    }
    const xml = await this.getDenonSources(receiver);
    return this.parseSources(xml, selectedIndex);
  }

  async getDenonSubwoofers(_receiver: DenonReceiver) {
    const receiver = _receiver;
    const [levelXml, powerXml] = await Promise.all([
      this.getDenonSubwooferLevels(receiver),
      this.getDenonSubwooferPowerConfig(receiver)
    ]);
    const levelMap = this.parseSubwooferLevels(levelXml);
    const globalPower = this.parseSubwooferPowerFlag(powerXml);
    const result: Subwoofer[] = [];
    const template = receiver.subwoofers ?? [];

    levelMap.forEach((db, index) => {
      let id = String(index);
      let name = `Subwoofer ${index}`;
      if (template[index - 1]) {
        const sw = template[index - 1];
        if (sw?.id) id = sw.id;
        if (sw?.name) name = sw.name;
      }
      result.push(new Subwoofer(id, name, globalPower, db));
    });
    return result;
  }

  async getDenonZones(_receiver: DenonReceiver) {
    const receiver = _receiver;
    const [powerXml, renameXml] = await Promise.all([
      this.getDenonZonePowerStatus(receiver),
      this.sendDenonGet(receiver.address, "/ajax/globals/get_config?type=6")
    ]);
    const powerMap = this.parseZonePower(powerXml);
    const renameMap = this.parseZoneRename(renameXml);
    const zoneTags = new Set<string>([...Object.keys(powerMap), ...Object.keys(renameMap)]);
    const result: Zone[] = [];
    zoneTags.forEach(tag => {
      const power = powerMap[tag] ?? false;
      const displayName = renameMap[tag] ?? tag;
      result.push(new Zone(tag, displayName, power));
    });
    return result;
  }

  private async sendDenonGet(address?: string, pathAndQuery?: string) {
    if (!address || !pathAndQuery) return "";
    const url = `https://${address}:10443${pathAndQuery}`;
    const agent = new https.Agent({ rejectUnauthorized: false });
    return new Promise<string>((resolve, reject) => {
      const req = https.request(
        url,
        { method: "GET", agent, timeout: 15000 },
        res => {
          let body = "";
          res.on("data", chunk => {
            body += chunk.toString("utf8");
          });
          res.on("end", () => {
            logger.debug({ url, statusCode: res.statusCode }, "Denon GET abgeschlossen");
            resolve(body);
          });
        }
      );
      req.on("error", err => {
        logger.error({ err, url }, "Denon GET fehlgeschlagen");
        reject(err);
      });
      req.on("timeout", () => {
        req.destroy(new Error("Denon GET timeout"));
      });
      req.end();
    });
  }

  private urlEncode(data: string) {
    return encodeURIComponent(data);
  }

  private resolveSubwooferTag(receiver: DenonReceiver, subwooferName: string) {
    const subs = receiver.subwoofers ?? [];
    if (!subs.length) return "SubwooferLevel1";
    const index = subs.findIndex(
      sw => sw?.name?.toLowerCase() === subwooferName.toLowerCase()
    );
    if (index === 0) return "SubwooferLevel1";
    if (index === 1) return "SubwooferLevel2";
    return "SubwooferLevel1";
  }

  private mapZoneTag(zoneName?: string) {
    if (!zoneName) return "MainZone";
    const normalized = zoneName.toLowerCase();
    if (normalized === "zone2" || normalized === "zone 2") return "Zone2";
    if (normalized === "zone3" || normalized === "zone 3") return "Zone3";
    return "MainZone";
  }

  private mapZoneIndex(zoneName?: string) {
    if (!zoneName) return "1";
    const normalized = zoneName.toLowerCase();
    if (normalized === "zone2" || normalized === "zone 2") return "2";
    if (normalized === "zone3" || normalized === "zone 3") return "3";
    return "1";
  }

  private parseTagValue(xml: string, tag: string) {
    const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, "i");
    const match = xml.match(regex);
    return match?.[1] ?? "";
  }

  private parseVolumeLimits(xml: string): [number, number] {
    const limitStr = this.parseTagValue(xml, "Limit");
    const powerOnStr = this.parseTagValue(xml, "PowerOnLevel");
    const limit = Number(limitStr);
    const powerOn = Number(powerOnStr);
    return [Number.isNaN(limit) ? 0 : limit, Number.isNaN(powerOn) ? 0 : powerOn];
  }

  private parseSubwooferLevels(xml: string) {
    const map = new Map<number, number>();
    for (let idx = 1; idx <= 2; idx += 1) {
      const value = this.parseTagValue(xml, `SubwooferLevel${idx}`);
      if (value) {
        const db = Number(value.trim());
        if (!Number.isNaN(db)) {
          map.set(idx, db);
        }
      }
    }
    return map;
  }

  private parseSubwooferPowerFlag(xml: string) {
    const value = this.parseTagValue(xml, "Subwoofer");
    return value === "1";
  }

  private parseZonePower(xml: string) {
    const result: Record<string, boolean> = {};
    const listGlobalsMatch = xml.match(/<listGlobals>([\s\S]*?)<\/listGlobals>/i);
    if (!listGlobalsMatch) return result;
    const zoneBlock = listGlobalsMatch[1];
    const zoneRegex = /<([A-Za-z0-9]+)>([\s\S]*?)<\/\1>/g;
    let match: RegExpExecArray | null;
    while ((match = zoneRegex.exec(zoneBlock))) {
      const tag = match[1];
      const block = match[2];
      const power = this.parseTagValue(block, "Power");
      if (power) {
        result[tag] = power === "1";
      }
    }
    return result;
  }

  private parseZoneRename(xml: string) {
    const result: Record<string, string> = {};
    const rootMatch = xml.match(/<ZoneRename>([\s\S]*?)<\/ZoneRename>/i);
    if (!rootMatch) return result;
    const zoneBlock = rootMatch[1];
    const zoneRegex = /<([A-Za-z0-9]+)>([\s\S]*?)<\/\1>/g;
    let match: RegExpExecArray | null;
    while ((match = zoneRegex.exec(zoneBlock))) {
      const tag = match[1];
      const value = match[2]?.trim();
      if (value) result[tag] = value;
    }
    return result;
  }

  private parseSources(xml: string, selectedIndex: string | null) {
    const result: Source[] = [];
    const sourceListMatch = xml.match(/<SourceList>([\s\S]*?)<\/SourceList>/i);
    if (!sourceListMatch) return result;
    const zoneMatch = sourceListMatch[1].match(/<Zone[^>]*>([\s\S]*?)<\/Zone>/i);
    if (!zoneMatch) return result;
    const sourcesBlock = zoneMatch[1];
    const sourceRegex = /<Source[^>]*index="([^"]+)"[^>]*>([\s\S]*?)<\/Source>/gi;
    let match: RegExpExecArray | null;
    while ((match = sourceRegex.exec(sourcesBlock))) {
      const index = match[1];
      const name = this.parseTagValue(match[2], "Name") || index;
      const selected = selectedIndex != null && selectedIndex === index;
      result.push(new Source(index, name, selected));
    }
    return result;
  }

  private getOrCreateConnection(address: string) {
    const key = address || "unknown";
    if (!this.connections.has(key)) {
      this.connections.set(key, new Connection(address));
    }
    return this.connections.get(key)!;
  }
}

export class Connection {
  private address: string;
  private socket?: net.Socket;
  private buffer = "";
  private state = "disconnected";
  private stateListeners: Array<(state: string) => void> = [];
  private eventListeners: Array<(event: Record<string, unknown>) => void> = [];

  constructor(address: string) {
    this.address = address;
  }

  getAddress() {
    return this.address;
  }

  getState() {
    return this.state;
  }

  addStateListener(listener: (state: string) => void) {
    this.stateListeners.push(listener);
  }

  addEventListener(listener: (event: Record<string, unknown>) => void) {
    this.eventListeners.push(listener);
  }

  onEvent(listener: (event: Record<string, unknown>) => void) {
    this.addEventListener(listener);
  }

  offEvent(listener: (event: Record<string, unknown>) => void) {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  async connect() {
    if (!this.address) {
      return;
    }
    if (this.socket && !this.socket.destroyed) {
      return;
    }
    this.setState("connecting");
    this.socket = new net.Socket();
    await new Promise<void>((resolve, reject) => {
      this.socket!.once("error", reject);
      this.socket!.connect(1255, this.address, () => {
        this.socket!.off("error", reject);
        resolve();
      });
    });
    this.socket.on("data", chunk => {
      this.buffer += chunk.toString("utf8");
      this.emitEvent({ raw: chunk.toString("utf8") });
    });
    this.setState("connected");
  }

  async disconnect() {
    if (!this.socket) return;
    this.setState("disconnecting");
    await new Promise<void>(resolve => {
      this.socket!.end(() => resolve());
    });
    this.socket = undefined;
    this.setState("disconnected");
  }

  async reconnect() {
    await this.disconnect();
    await this.connect();
  }

  async send(command: string, queryParams: Record<string, unknown> = {}) {
    if (!this.socket || this.socket.destroyed) {
      throw new Error("Nicht verbunden");
    }
    const query = new URLSearchParams(
      Object.entries(queryParams).map(([key, value]) => [key, String(value)])
    ).toString();
    const message = `heos://${command}${query ? `?${query}` : ""}\r\n`;
    this.socket.write(message, "utf8");
    return this.waitForResponse();
  }

  async playerGetPlayers() {
    const response = await this.send("player/get_players");
    if (Array.isArray(response.payload)) {
      return response.payload as Record<string, unknown>[];
    }
    return [];
  }

  async playerGetPlayerInfo(pid: number) {
    return this.send("player/get_player_info", { pid });
  }

  async playerGetPlayState(pid: number) {
    const response = await this.send("player/get_play_state", { pid });
    const payload = response?.payload as { state?: string } | undefined;
    return String(payload?.state ?? "");
  }

  async playerSetPlayState(pid: number, state: string) {
    await this.send("player/set_play_state", { pid, state });
  }

  async playerGetNowPlayingMedia(pid: number) {
    return this.send("player/get_now_playing_media", { pid });
  }

  async playerGetVolume(pid: number) {
    const response = await this.send("player/get_volume", { pid });
    const payload = response?.payload as { level?: string | number } | undefined;
    const volume = Number(payload?.level ?? 0);
    return Number.isNaN(volume) ? 0 : volume;
  }

  async playerSetVolume(pid: number, level: number) {
    await this.send("player/set_volume", { pid, level });
  }

  async playerGetMute(pid: number) {
    const response = await this.send("player/get_mute", { pid });
    const payload = response?.payload as { state?: string } | undefined;
    const muted = String(payload?.state ?? "off");
    return muted === "on";
  }

  async playerSetMute(pid: number, mute: boolean) {
    await this.send("player/set_mute", { pid, state: mute ? "on" : "off" });
  }

  async playerPlayNext(pid: number) {
    await this.send("player/play_next", { pid });
  }

  async playerPlayPrevious(pid: number) {
    await this.send("player/play_previous", { pid });
  }

  async playerPlayPreset(pid: number, preset: number) {
    await this.send("player/play_preset", { pid, preset });
  }

  async playerGetPlayMode(pid: number) {
    const response = await this.send("player/get_play_mode", { pid });
    const payload = response?.payload as { repeat?: string } | undefined;
    return String(payload?.repeat ?? "");
  }

  async playerSetPlayMode(pid: number, shuffle: boolean, repeat: string) {
    await this.send("player/set_play_mode", { pid, shuffle, repeat });
  }

  async browseGetMusicSources() {
    const response = await this.send("browse/get_music_sources");
    if (Array.isArray(response.payload)) {
      return response.payload as Record<string, unknown>[];
    }
    return [];
  }

  async browsePlayStream(pid: number, sid: number, mid: number, spid: number, input: string) {
    await this.send("browse/play_stream", { pid, sid, mid, spid, input });
  }

  async browsePlayInput(pid: number, input: string) {
    await this.send("browse/play_input", { pid, input });
  }

  async browsePlayAuxIn1(pid: number) {
    await this.send("browse/play_aux_in_1", { pid });
  }

  async systemRegisterForChangeEvents(enabled: boolean) {
    await this.send("system/register_for_change_events", { enable: enabled ? "on" : "off" });
  }

  private async waitForResponse(): Promise<HeosResponse> {
    const timeoutMs = 5000;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const idx = this.buffer.indexOf("\r\n");
      if (idx !== -1) {
        const line = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 2);
        try {
          return JSON.parse(line) as HeosResponse;
        } catch (err) {
          return {} as HeosResponse;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error("Timeout beim Warten auf HEOS Antwort");
  }

  private setState(nextState: string) {
    this.state = nextState;
    this.stateListeners.forEach(listener => listener(nextState));
  }

  private emitEvent(event: Record<string, unknown>) {
    this.eventListeners.forEach(listener => listener(event));
  }
}

