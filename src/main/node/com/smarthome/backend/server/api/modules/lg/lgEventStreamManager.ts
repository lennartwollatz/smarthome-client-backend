import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../../../../logger.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import type { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import type { LGTV } from "./lgtv.js";

export class LGEventStreamManager implements ModuleEventStreamManager {
  private deviceId: string;
  private actionManager: ActionManager;
  private running = false;
  private process: ReturnType<typeof spawn> | null = null;
  private outputBuffer = "";

  constructor(deviceId: string, actionManager: ActionManager) {
    this.deviceId = deviceId;
    this.actionManager = actionManager;
  }

  async start() {
    if (this.running) {
      logger.warn({ deviceId: this.deviceId }, "LG EventStream laeuft bereits");
      return;
    }
    const device = this.actionManager.getDevice(this.deviceId) as LGTV | null;
    if (!device || device.moduleId !== "lg") {
      throw new Error(`LGTV mit ID '${this.deviceId}' nicht gefunden`);
    }
    if (!device.address) {
      throw new Error(`Keine gültige IP-Adresse für LGTV '${this.deviceId}'`);
    }
    if (!device.clientKey) {
      throw new Error(`Kein Client-Key für LGTV '${this.deviceId}'`);
    }

    this.running = true;
    const scriptPath = resolveScriptPath("scripts", "pywebostv", "subscribe.py");
    const args = [
      scriptPath,
      "--ip",
      device.address,
      "--client-key",
      device.clientKey,
      "--events",
      "all"
    ];
    const child = spawn("python", args, { windowsHide: true });
    this.process = child;
    child.stdout.on("data", chunk => this.handleStdout(chunk.toString("utf8")));
    child.stderr.on("data", chunk =>
      logger.debug("LG EventStream stderr: {}", chunk.toString("utf8"))
    );
    child.on("close", code => {
      this.running = false;
      this.process = null;
      this.outputBuffer = "";
      logger.info({ deviceId: this.deviceId, code }, "LG EventStream beendet");
    });
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.outputBuffer = "";
  }

  isRunning() {
    return this.running;
  }

  getModuleId() {
    return "lg";
  }

  getManagerId() {
    return this.deviceId;
  }

  getDescription() {
    return `LG EventStream für Gerät ${this.deviceId}`;
  }

  private handleEventLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      logger.debug("LG EventStream ignoriert: {}", line);
      return;
    }
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(trimmed);
    } catch {
      logger.debug("LG EventStream JSON ungültig: {}", line);
      return;
    }
    if (event.event === "error") {
      logger.warn("LG EventStream error: {}", event);
      return;
    }
    const device = this.actionManager.getDevice(this.deviceId) as LGTV | null;
    if (!device || device.moduleId !== "lg") return;

    const eventName = event.event as string | undefined;
    const payload = event.payload as Record<string, unknown> | string | undefined;
    if (!eventName || payload == null) return;

    if (eventName === "app.current") {
      const appId = extractAppId(payload);
      if (appId) {
        device.startApp(appId, false);
        this.actionManager.saveDevice(device);
      }
    }
    if (eventName === "channel.current") {
      const channelId = extractChannelId(payload);
      if (channelId) {
        device.setChannel(channelId, false);
        this.actionManager.saveDevice(device);
      }
    }
  }

  private handleStdout(chunk: string) {
    this.outputBuffer += chunk;
    let newlineIndex = this.outputBuffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = this.outputBuffer.slice(0, newlineIndex);
      this.outputBuffer = this.outputBuffer.slice(newlineIndex + 1);
      this.handleEventLine(line);
      newlineIndex = this.outputBuffer.indexOf("\n");
    }
  }
}

function extractAppId(payload: Record<string, unknown> | string) {
  if (typeof payload === "string") return payload;
  if (payload.id && typeof payload.id === "string") return payload.id;
  if (payload.appId && typeof payload.appId === "string") return payload.appId;
  return null;
}

function extractChannelId(payload: Record<string, unknown> | string) {
  if (typeof payload === "string") return payload;
  if (payload.channelId && typeof payload.channelId === "string") return payload.channelId;
  if (payload.id && typeof payload.id === "string") return payload.id;
  return null;
}

function resolveScriptPath(...parts: string[]) {
  let current = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    const candidate = path.resolve(current, ...parts);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    current = path.resolve(current, "..");
  }
  return path.resolve(process.cwd(), ...parts);
}

