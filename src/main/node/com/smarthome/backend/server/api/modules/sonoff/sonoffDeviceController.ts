import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { logger } from "../../../../logger.js";
import { Device } from "../../../../model/devices/Device.js";
import { ModuleDeviceControllerEvent } from "../moduleDeviceControllerEvent.js";
import { SonoffEvent } from "./sonoffEvent.js";
import { SonoffDeviceDiscovered } from "./sonoffDeviceDiscovered.js";
import { SonoffBasicDevice, SonoffLanEndDevice } from "./devices/sonoffDevice.js";
import { isSonoffSwitchLanPayloadOk } from "./devices/sonoffSwitchLanPayload.js";


/** Letztes JSON aus pysonofflanr3 Debug-Zeile `decrypted data: b'{...}'` (mDNS). */
function extractLastDecryptedJsonFromPysonoffLog(log: string): Record<string, unknown> | null {
  const needle = "decrypted data: b'";
  let last: Record<string, unknown> | null = null;
  let from = 0;
  while (from < log.length) {
    const i = log.indexOf(needle, from);
    if (i === -1) break;
    const j = i + needle.length;
    if (log[j] !== "{") {
      from = i + 1;
      continue;
    }
    let depth = 0;
    let k = j;
    for (; k < log.length; k++) {
      const c = log[k];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          try {
            last = JSON.parse(log.slice(j, k + 1)) as Record<string, unknown>;
          } catch {
            /* nächstes Vorkommen */
          }
          break;
        }
      }
    }
    from = k + 1;
  }
  return last;
}

function sonoffLanVenvUsable(dir: string): boolean {
  if (process.platform === "win32") {
    return existsSync(path.join(dir, ".venv", "Scripts", "python.exe"));
  }
  return (
    existsSync(path.join(dir, ".venv", "bin", "python")) ||
    existsSync(path.join(dir, ".venv", "bin", "python3"))
  );
}

/** Absolutes Verzeichnis ``smarthome-client-backend/scripts/sonofflan`` (venv mit pysonofflanr3). */
function sonoffLanScriptsDir(): string {
  const cwd = process.cwd();
  const fromMainNode = path.resolve(cwd, "../../../scripts/sonofflan");
  const fromRepoRoot = path.resolve(cwd, "scripts/sonofflan");
  if (sonoffLanVenvUsable(fromMainNode)) return fromMainNode;
  if (sonoffLanVenvUsable(fromRepoRoot)) return fromRepoRoot;
  throw new Error(
    `pysonofflan venv fehlt unter ${fromMainNode} oder ${fromRepoRoot} (erwartet .venv mit pysonofflanr3)`
  );
}

/**
 * Relativ zu {@link sonoffLanScriptsDir} — unter Linux: ``./.venv/bin/python`` (oder ``python3`` falls nur dieser existiert).
 */
function sonoffCliPythonRelative(lanDir: string): string {
  if (process.platform === "win32") {
    return path.join(".venv", "Scripts", "python.exe");
  }
  if (existsSync(path.join(lanDir, ".venv", "bin", "python"))) {
    return "./.venv/bin/python";
  }
  if (existsSync(path.join(lanDir, ".venv", "bin", "python3"))) {
    return "./.venv/bin/python3";
  }
  return "./.venv/bin/python";
}

/** Spawn mit ``cwd = scripts/sonofflan`` (Modul ``pysonofflanr3`` liegt dort). */
function sonoffCliSpawnOptions(cwd: string): SpawnOptions {
  return {
    cwd,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  };
}

/**
 * Debug: exakter Node-`spawn`-Aufruf auf stdout — inkl. `--api_key` und aller CLI-Argumente.
 * Nicht für Produktionslogs mit externer Aggregation verwenden (Geheimnis im Klartext).
 */
function logSonoffPythonInvocation(
  context: string,
  lanDir: string,
  pythonRelative: string,
  args: string[]
): void {
  const spawnOpts = sonoffCliSpawnOptions(lanDir);
  const psQuote = (s: string) => `'${String(s).replace(/'/g, "''")}'`;
  const argStr = args.map(a => (/[\s]/.test(a) ? psQuote(a) : a)).join(" ");
  const approxCmdline = `(cd ${psQuote(lanDir)} && ${pythonRelative} ${argStr})`;
  console.log(`[SonoffDeviceController] Python spawn — ${context}`);
  console.log(
    JSON.stringify(
      {
        context,
        spawn: { file: pythonRelative, args, cwd: lanDir },
        argvFull: [pythonRelative, ...args],
        nodeProcessCwd: process.cwd(),
        platform: process.platform,
        spawnOptions: {
          cwd: lanDir,
          windowsHide: spawnOpts.windowsHide,
          stdio: spawnOpts.stdio,
          envInheritedFromProcess: true,
        },
        approxCmdlineForCopyPaste: approxCmdline,
      },
      null,
      2
    )
  );
}

export class SonoffDeviceController extends ModuleDeviceControllerEvent<SonoffEvent, Device> {
  /** Ein Live-Prozess pro eWeLink-Gerätid (Python ``getState`` = mDNS-Listener + statistics). */
  private readonly liveStreamByEwelinkId = new Map<string, ChildProcess>();


  async pairDevice(device: SonoffDeviceDiscovered): Promise<SonoffDeviceDiscovered | null> {
    const apiKey = device.apiKey?.trim();
    if (!apiKey) return null;
    const ewelinkId = device.ewelinkDeviceId;
    if (!ewelinkId) {
      logger.warn({ deviceId: device.id }, "Sonoff Pairing abgebrochen: ewelinkDeviceId fehlt");
      return null;
    }
    const ok = await this.verifyLan(device.address, device.port, ewelinkId, apiKey);
    if (!ok) {
      logger.warn(
        { deviceId: device.id, address: device.address },
        "Sonoff LAN-Verifikation fehlgeschlagen (scripts/sonofflan/.venv / API-Key / Geraet-ID / erreichbar?)"
      );
      return null;
    }
    device.apiKey = apiKey;
    device.isPaired = true;
    device.pairedAt = Date.now();
    return device;
  }

  private async verifyLan(address: string, _port: number, ewelinkDeviceId: string, apiKey: string): Promise<boolean> {
    try {
      const status = await this.getStatus(
        new SonoffBasicDevice(ewelinkDeviceId, address, _port, apiKey)
      );
      return isSonoffSwitchLanPayloadOk(status as Record<string, unknown> | null);
    } catch (err) {
      logger.warn(
        { err, address, ewelinkDeviceId },
        "Sonoff LAN-Verifikation: Python-Aufruf fehlgeschlagen (scripts/sonofflan/.venv vorhanden?)"
      );
      return false;
    }
  }

  private async setSwitchStatus(device: SonoffLanEndDevice, outlet:string, on_off:boolean): Promise<Record<string, unknown> | null> {
    
      const args = [
        "-m",
        "pysonofflanr3.cli",
        "--host",
        device.getLanAddress(),
        "--device_id",
        device.getEwelinkDeviceId(),
        "--api_key",
        device.getLanApiKey(),
        "-l",
        "CRITICAL",
        "--outlet",
        outlet,
        on_off ? "on" : "off",
      ];
      return await this.sendAndResolve(device, args);
  }

  private async setSwitchBrightness(device: SonoffLanEndDevice, outlet:string, level:number): Promise<Record<string, unknown> | null> {
    const on_off = device.getButton(outlet)?.on ?? false;
    const args = [
      "-m",
      "pysonofflanr3.cli",
      "--host",
      device.getLanAddress(),
      "--device_id",
      device.getEwelinkDeviceId(),
      "--api_key",
      device.getLanApiKey(),
      "-l",
      "CRITICAL",
      "--outlet",
      outlet,
      "brightness",
      String(level),
      on_off ? "on" : "off"
    ];
    return await this.sendAndResolve(device, args);
}

  private async sendAndResolve(device: SonoffLanEndDevice, args: string[]): Promise<Record<string, unknown> | null> {
    const timeoutMs = 10_000;
    const lanDir = sonoffLanScriptsDir();
    const python = sonoffCliPythonRelative(lanDir);
    const spawnOpts = sonoffCliSpawnOptions(lanDir);
    logSonoffPythonInvocation(
      `sendAndResolve ${device.getEwelinkDeviceId()} @ ${device.getLanAddress()}`,
      lanDir,
      python,
      args
    );

    return new Promise(resolve => {
      const child = spawn(python, args, spawnOpts);
      let stdout = "";
      let stderr = "";
      let stdoutLineBuffer = "";
      let settled = false;
      const resolveAndStop = (payload: Record<string, unknown> | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          if (!child.killed) child.kill("SIGTERM");
        } catch {
          // ignore
        }
        resolve(payload);
      };
      const finish = (exitCode: number | null) => {
        if (settled) return;
        let decryptedPayload: Record<string, unknown> | null = null;
        try {
          decryptedPayload = JSON.parse(stdout);
        } catch {
          decryptedPayload = extractLastDecryptedJsonFromPysonoffLog(`${stdout}\n${stderr}`);
        }
        const ok = exitCode === 0 || decryptedPayload !== null;
        if (!ok || !isSonoffSwitchLanPayloadOk(decryptedPayload)) {
          logger.debug(
            { code: exitCode, address: device.getLanAddress(), stderrTail: stderr.trim().slice(-800) },
            "Sonoff verifyLan: pysonofflanr3 state fehlgeschlagen"
          );
        }
        resolveAndStop(decryptedPayload);
      };

      child.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        stdoutLineBuffer += text;
        let newline: number;
        while ((newline = stdoutLineBuffer.indexOf("\n")) >= 0) {
          const line = stdoutLineBuffer.slice(0, newline).trim();
          stdoutLineBuffer = stdoutLineBuffer.slice(newline + 1);
          if (!line) continue;
          try {
            const parsed = JSON.parse(line) as Record<string, unknown>;
            // Nicht-Live Aufrufe sollen sofort zurückkehren, sobald ein verwertbares JSON vorliegt.
            resolveAndStop(parsed);
            return;
          } catch {
            // kein JSON-Line-Fragment
          }
        }
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      const timer = setTimeout(() => {
        logger.debug({ address: device.getLanAddress(), ewelinkDeviceId: device.getEwelinkDeviceId() }, "Sonoff verifyLan: Python state-Timeout, sende SIGTERM");
        try {
          child.kill("SIGTERM");
        } catch {
          finish(null);
        }
      }, timeoutMs);
      child.on("error", err => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        logger.debug({ err, python }, "Sonoff verifyLan: Python-Prozess nicht startbar");
        resolve(null);
      });
      child.on("close", code => {
        finish(code);
      });
    });
  }

  async getStatus(device: SonoffLanEndDevice): Promise<Record<string, unknown> | null> {
    const args = [
      "-m",
      "pysonofflanr3.cli",
      "--host",
      device.getLanAddress(),
      "--device_id",
      device.getEwelinkDeviceId(),
      "--api_key",
      device.getLanApiKey(),
      "-l",
      "CRITICAL",
      "state",
    ];

    return await this.sendAndResolve(device, args);
  }

  async toggleSwitch(device: SonoffLanEndDevice, buttonId: string): Promise<boolean> {
    const response = await this.setSwitchStatus(device, buttonId, !(device.getButton(buttonId)?.on ?? false));
    return ((response as Record<string, unknown>)?.ok as boolean) ?? false;
  }

  async setOn(device: SonoffLanEndDevice, buttonId: string): Promise<boolean> {
    const response = await this.setSwitchStatus(device, buttonId, true);
    return ((response as Record<string, unknown>)?.ok as boolean) ?? false;
  }

  async setOff(device: SonoffLanEndDevice, buttonId: string): Promise<boolean> {
    const response = await this.setSwitchStatus(device, buttonId, false);
    return ((response as Record<string, unknown>)?.ok as boolean) ?? false;
  }

  async setIntensity(device: SonoffLanEndDevice, buttonId: string, intensity: number): Promise<boolean> {
    const level = Math.max(0, Math.min(100, Math.round(intensity)));
    const response = await this.setSwitchBrightness(device, buttonId, level);
    return ((response as Record<string, unknown>)?.ok as boolean) ?? false;
  }

  private liveStreamArgsForDevice(device: Device): string[] {
    const args = [
      "-m",
      "pysonofflanr3.cli",
      "--host",
      (device as any).lanAddress ?? "",
      "--device_id",
      (device as any).ewelinkDeviceId ?? "",
      "--api_key",
      (device as any).lanApiKey ?? "",
      "-l",
      "CRITICAL",
      "getState",
    ];
    return args;
  }

  /**
   * mDNS-Livestream: **ein** Python-Prozess pro Gerät (`getState`: mDNS + statistics), kein stdin-JSON.
   */
  async startLanLiveEventStream(devices: Device[], callback: (event: SonoffEvent) => void): Promise<void> {
    await this.stopLanLiveEventStream();
    const lan = devices;
    if (!lan.length) {
      logger.warn("Sonoff LAN-Livestream: keine Geräte");
      return;
    }
    let lanDir: string;
    let python: string;
    let spawnOpts: SpawnOptions;
    try {
      lanDir = sonoffLanScriptsDir();
      python = sonoffCliPythonRelative(lanDir);
      spawnOpts = sonoffCliSpawnOptions(lanDir);
    } catch (err) {
      logger.error({ err }, "Sonoff LAN-Livestream: scripts/sonofflan/.venv fehlt, Abbruch");
      return;
    }

    for (const d of lan) {
      const ewelinkId = (d as any).ewelinkDeviceId ?? "";
      const backendId = d.id;
      const args = this.liveStreamArgsForDevice(d);
      logSonoffPythonInvocation(`LAN-Livestream ${ewelinkId} (backend ${backendId})`, lanDir, python, args);
      const child = spawn(python, args, spawnOpts);
      this.liveStreamByEwelinkId.set(ewelinkId, child);

      let buf = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        buf += chunk.toString("utf-8");
        let newline: number;
        while ((newline = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, newline).trim();
          buf = buf.slice(newline + 1);
          if (!line) {
            continue;
          }
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(line) as Record<string, unknown>;
          } catch {
            continue;
          }
          const reachable = !("ok" in parsed) || parsed.ok === true;
          callback({
            event: "lanState",
            name: "lanState",
            deviceId: backendId,
            ewelinkDeviceId: ewelinkId,
            online: reachable,
            reachable,
            payload: parsed,
          });
        }
      });
      child.stderr?.on("data", (c: Buffer) => {
        
      });
      child.on("error", err => {
        logger.error({ err, ewelinkId, python }, "Sonoff LAN-Livestream Prozess");
      });
      child.on("close", (code, signal) => {
        this.liveStreamByEwelinkId.delete(ewelinkId);
        logger.info({ code, signal, ewelinkId }, "Sonoff LAN-Livestream beendet");
      });
    }
  }

  async stopLanLiveEventStream(): Promise<void> {
    for (const [ewelinkId, p] of this.liveStreamByEwelinkId) {
      try {
        if (!p.killed) {
          p.kill("SIGTERM");
        }
      } catch (err) {
        logger.debug({ err, ewelinkId }, "Sonoff LAN-Livestream SIGTERM");
      }
    }
    this.liveStreamByEwelinkId.clear();
  }

  async startEventStream(device: Device, callback: (event: SonoffEvent) => void): Promise<void> {
    await this.startLanLiveEventStream([device], callback);
  }

  async stopEventStream(device: Device): Promise<void> {
    await this.stopLanLiveEventStream();
  }
}
