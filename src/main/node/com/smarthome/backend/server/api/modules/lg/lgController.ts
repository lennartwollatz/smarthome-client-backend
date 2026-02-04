import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../../../../logger.js";
import { App, Channel } from "../../../../model/devices/DeviceTV.js";
import type { LGTV } from "./lgtv.js";

type JsonValue = Record<string, unknown> | null;

export class LGController {
  static async register(tv: LGTV) {
    if (tv.clientKey) return true;
    if (!tv.address) return false;

    logger.info({ address: tv.address }, "register() fuer LGTV");
    const scriptPath = resolveScriptPath("scripts", "pywebostv", "register.py");
    const args = ["CONNECT", "--ip", tv.address];
    try{
      const { output, code } = await runPython(scriptPath, args);
    
      const keyMatch = output.match(/'client_key'\s*:\s*'([^']+)'/);
      if (keyMatch?.[1]) {
        tv.clientKey = keyMatch[1];
        tv.isConnected = true;
      }
      if (code !== 0) {
        logger.error(
          { code, output: output.trim() },
          "PyWebOSTV-Skript beendet mit Exit-Code fuer {}",
          tv.address
        );
      }
      return Boolean(tv.clientKey);
    } catch (err) {
      console.log("Fehler beim Starten des PyWebOSTV-Skripts für "+tv.address+": "+JSON.stringify(err));
      return false;
    }
  }

  static async powerOn(tv: LGTV) {
    logger.info({ address: tv.address }, "powerOn() fuer LGTV: "+tv.address);
    if (!tv.macAddress) return;
    const params = `{"mac":"${tv.macAddress}"}`;
    await this.callController(tv.address, tv.clientKey, "wol", params);
  }

  static async powerOff(tv: LGTV) {
    logger.info({ address: tv.address }, "powerOff() fuer LGTV: "+tv.address);
    await this.callController(tv.address, tv.clientKey, "system.power_off", null);
  }

  static async screenOn(tv: LGTV) {
    logger.info({ address: tv.address }, "screenOn() fuer LGTV");
    await this.callController(tv.address, tv.clientKey, "system.screen_on", null);
  }

  static async screenOff(tv: LGTV) {
    logger.info({ address: tv.address }, "screenOff() fuer LGTV");
    await this.callController(tv.address, tv.clientKey, "system.screen_off", null);
  }

  static async setVolume(tv: LGTV, volume: number) {
    logger.info({ address: tv.address, volume }, "setVolume() fuer LGTV");
    if (!tv.clientKey) {
      logger.warn("setVolume() abgebrochen: Client-Key fehlt");
      return;
    }
    if (volume < 1 || volume > 100) {
      logger.warn({ volume }, "setVolume() abgebrochen: Volume ausserhalb Bereich (1-100)");
      return;
    }
    await this.callController(tv.address, tv.clientKey, "media.set_volume", String(volume));
  }

  static async getVolume(tv: LGTV) {
    logger.info({ address: tv.address }, "getVolume() fuer LGTV");
    if (!tv.clientKey) {
      logger.warn("getVolume() abgebrochen: Client-Key fehlt");
      return null;
    }
    const response = await this.callController(tv.address, tv.clientKey, "media.get_volume", null);
    if (!response) return null;
    if ((response as Record<string, unknown>)?.status === "error") {
      logger.warn({ response }, "getVolume() fehlgeschlagen");
      return null;
    }
    const volumeStatus = (response?.result as Record<string, unknown> | undefined)?.volumeStatus as
      | Record<string, unknown>
      | undefined;
    const volume = volumeStatus?.volume;
    return typeof volume === "number" ? volume : null;
  }

  static async setChannel(tv: LGTV, channelId: string) {
    logger.info({ address: tv.address }, "setChannel() fuer LGTV");
    if (!tv.clientKey) {
      logger.warn("setChannel() abgebrochen: Client-Key fehlt");
      return;
    }
    const escaped = channelId.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    await this.callController(tv.address, tv.clientKey, "tv.set_channel_with_id", `"${escaped}"`);
  }

  static async startApp(tv: LGTV, appId: string) {
    logger.info({ address: tv.address }, "startApp() fuer LGTV");
    if (!tv.clientKey) {
      logger.warn("startApp() abgebrochen: Client-Key fehlt");
      return;
    }
    const escaped = appId.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    await this.callController(tv.address, tv.clientKey, "application.launch", `"${escaped}"`);
  }

  static async notify(tv: LGTV, message: string) {
    logger.info({ address: tv.address }, "notify() fuer LGTV");
    if (!message) {
      logger.warn("notify() abgebrochen: Nachricht fehlt");
      return;
    }
    const escaped = message.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    await this.callController(tv.address, tv.clientKey, "system.notify", `{"message":"${escaped}"}`);
  }

  static async getChannels(tv: LGTV) {
    logger.info({ address: tv.address }, "getChannels() fuer LGTV");
    if (!tv.clientKey) {
      logger.warn("getChannels() abgebrochen: Client-Key fehlt");
      return null;
    }
    const response = await this.callController(tv.address, tv.clientKey, "tv.channel_list", null);
    return parseChannels(response);
  }

  static async getApps(tv: LGTV) {
    logger.info({ address: tv.address }, "getApps() fuer LGTV");
    if (!tv.clientKey) {
      logger.warn("getApps() abgebrochen: Client-Key fehlt");
      return null;
    }
    const response = await this.callController(tv.address, tv.clientKey, "application.list_apps", null);
    return parseApps(response);
  }

  static async getSelectedApp(tv: LGTV) {
    logger.info({ address: tv.address }, "getSelectedApp() fuer LGTV");
    if (!tv.clientKey) {
      logger.warn("getSelectedApp() abgebrochen: Client-Key fehlt");
      return null;
    }
    const response = await this.callController(tv.address, tv.clientKey, "application.get_current", null);
    if (!response) return null;
    if ((response as Record<string, unknown>)?.status === "error") {
      logger.warn({ response }, "getSelectedApp() fehlgeschlagen");
      return null;
    }
    return typeof response?.result === "string" ? response?.result : null;
  }

  static async getSelectedChannel(tv: LGTV) {
    logger.info({ address: tv.address }, "getSelectedChannel() fuer LGTV");
    if (!tv.clientKey) {
      logger.warn("getSelectedChannel() abgebrochen: Client-Key fehlt");
      return null;
    }
    const response = await this.callController(tv.address, tv.clientKey, "tv.get_current_channel", null);
    if (!response) return null;
    if ((response as Record<string, unknown>)?.status === "error") {
      logger.warn({ response }, "getSelectedChannel() fehlgeschlagen");
      return null;
    }
    const result = response?.result as Record<string, unknown> | undefined;
    const channelId = result?.channelId;
    return typeof channelId === "string" ? channelId : null;
  }

  private static async callController(
    address: string | undefined,
    clientKey: string | null | undefined,
    event: string,
    params: string | null
  ): Promise<JsonValue> {
    if (!address) return null;
    if (event !== "wol" && !clientKey) return null;

    const scriptPath = resolveScriptPath("scripts", "pywebostv", "controller.py");
    const args = ["--ip", address];
    if (clientKey) {
      args.push("--client-key", clientKey);
    }
    args.push("--event", event);
    if (params != null) {
      args.push("--params", params);
    }
    const { output, code } = await runPython(scriptPath, args);
    if (code !== 0) {
      logger.error(
        { code, output: output.trim(), args },
        "PyWebOSTV-Skript beendet mit Exit-Code fuer {}",
        address
      );
    }
    const lastJsonLine = output
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.startsWith("{") && line.endsWith("}"))
      .pop();
    if (!lastJsonLine) return null;
    try {
      return JSON.parse(lastJsonLine) as JsonValue;
    } catch (err) {
      logger.warn({ err }, "PyWebOSTV-Output ist kein gültiges JSON: {}", lastJsonLine);
      return null;
    }
  }
}

function parseChannels(response: JsonValue) {
  if (!response) return null;
  if ((response as Record<string, unknown>)?.status === "error") {
    logger.warn({ response }, "getChannels() fehlgeschlagen");
    return null;
  }
  const result = response.result as Record<string, unknown> | undefined;
  const channelList = result?.channelList as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(channelList)) return null;
  return channelList
    .map(channelObj => {
      const id = channelObj.channelId as string | undefined;
      const channelNumber = typeof channelObj.majorNumber === "number" ? channelObj.majorNumber : undefined;
      const channelType = channelObj.channelMode as string | undefined;
      const hd = typeof channelObj.HDTV === "boolean" ? channelObj.HDTV : undefined;
      const name = channelObj.channelName as string | undefined;
      const imgUrl = channelObj.imgUrl as string | undefined;
      return new Channel(id, name, channelNumber, channelNumber, channelType, hd, imgUrl);
    })
    .filter(channel => Boolean(channel.id));
}

function parseApps(response: JsonValue) {
  if (!response) return null;
  if ((response as Record<string, unknown>)?.status === "error") {
    logger.warn({ response }, "getApps() fehlgeschlagen");
    return null;
  }
  const result = response.result as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(result)) return null;
  const apps: App[] = [];
  result.forEach((appObj, idx) => {
    const id = appObj.id as string | undefined;
    const name = appObj.title as string | undefined;
    const imgUrl = appObj.icon as string | undefined;
    if (!id || !name) return;
    apps.push(new App(id, name, imgUrl, idx + 1));
  });
  return apps;
}

async function runPython(scriptPath: string, args: string[]) {
  return new Promise<{ output: string; code: number | null }>(resolve => {
    const child = spawn("python", [scriptPath, ...args], { windowsHide: true });
    let output = "";
    child.stdout.on("data", chunk => {
      output += chunk.toString("utf8");
    });
    child.stderr.on("data", chunk => {
      output += chunk.toString("utf8");
    });
    child.on("close", code => {
      resolve({ output, code });
    });
  });
}

function escapeArgIfWindows(value: string) {
  return value;
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

