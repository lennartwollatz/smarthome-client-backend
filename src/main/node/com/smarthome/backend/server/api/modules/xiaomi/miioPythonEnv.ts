import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { logger } from "../../../../logger.js";

function miioVenvUsable(dir: string): boolean {
  if (process.platform === "win32") {
    return existsSync(path.join(dir, ".venv", "Scripts", "python.exe"));
  }
  return (
    existsSync(path.join(dir, ".venv", "bin", "python")) || existsSync(path.join(dir, ".venv", "bin", "python3"))
  );
}

/** Absolutes Verzeichnis ``smarthome-client-backend/scripts/miio`` (venv mit ``python-miio`` / ``miiocli``). */
export function miioScriptsDir(): string {
  const cwd = process.cwd();
  const fromMainNode = path.resolve(cwd, "../../../scripts/miio");
  const fromRepoRoot = path.resolve(cwd, "scripts/miio");
  if (miioVenvUsable(fromMainNode)) return fromMainNode;
  if (miioVenvUsable(fromRepoRoot)) return fromRepoRoot;
  throw new Error(
    `miio venv fehlt unter ${fromMainNode} oder ${fromRepoRoot} (erwartet .venv mit python-miio)`
  );
}

/**
 * Relativ zu {@link miioScriptsDir} — unter Linux: ``./.venv/bin/python`` (oder ``python3`` falls nur dieser existiert).
 */
export function miioPythonRelative(scriptsDir: string): string {
  if (process.platform === "win32") {
    return path.join(".venv", "Scripts", "python.exe");
  }
  if (existsSync(path.join(scriptsDir, ".venv", "bin", "python"))) {
    return "./.venv/bin/python";
  }
  if (existsSync(path.join(scriptsDir, ".venv", "bin", "python3"))) {
    return "./.venv/bin/python3";
  }
  return "./.venv/bin/python";
}

/** Spawn mit ``cwd = scripts/miio`` (Skripte ``controller.py`` / ``discover.py`` / ``register.py`` / ``subscribe.py``). */
export function miioSpawnOptions(cwd: string): SpawnOptions {
  return {
    cwd,
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      PYTHONWARNINGS: [process.env.PYTHONWARNINGS, "ignore::DeprecationWarning"].filter(Boolean).join(","),
    },
  };
}

export type MiioPythonRunResult = { stdout: string; stderr: string; code: number | null };

/**
 * Führt ``python <scriptName> ...args`` im Verzeichnis ``scripts/miio`` mit dem venv-Interpreter aus.
 * (Für dauerhafte Prozesse z. B. {@link spawnMiioPython} verwenden.)
 */
export async function runMiioPythonScript(scriptName: string, args: string[] = []): Promise<MiioPythonRunResult> {
  return new Promise(resolve => {
    let scriptsDir: string;
    let python: string;
    let spawnOpts: SpawnOptions;
    try {
      scriptsDir = miioScriptsDir();
      python = miioPythonRelative(scriptsDir);
      spawnOpts = miioSpawnOptions(scriptsDir);
    } catch (err) {
      logger.error({ err }, "miio: scripts/miio/.venv fehlt, Abbruch");
      resolve({ stdout: "", stderr: String(err), code: 1 });
      return;
    }
    const child = spawn(python, [scriptName, ...args], spawnOpts);
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", err => {
      logger.error({ err, python, scriptsDir }, "miio Python nicht startbar");
      resolve({ stdout, stderr: stderr + String(err), code: 1 });
    });
    child.on("close", code => {
      resolve({ stdout, stderr, code });
    });
  });
}

/** Startet den miio-venv-Interpreter; Aufrufer muss ``stdout``/``stderr``/``close`` binden. */
export function spawnMiioPython(scriptName: string, args: string[] = []): ChildProcess {
  const scriptsDir = miioScriptsDir();
  const python = miioPythonRelative(scriptsDir);
  return spawn(python, [scriptName, ...args], miioSpawnOptions(scriptsDir));
}
