#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys


def _emit_json(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=True))
    sys.stdout.write("\n")
    sys.stdout.flush()


def _parse_json(stdout):
    data = json.loads(stdout.strip())
    return {"ok": True, "result": data}


def _parse_text(stdout):
    return {"ok": True, "result_text": stdout.strip()}


def _run_miiocli(cmd):
    attempts = [cmd + ["--json"], cmd + ["-j"], cmd]
    last_result = None
    for attempt in attempts:
        try:
            result = subprocess.run(
                attempt,
                text=True,
                capture_output=True,
                check=False,
            )
        except FileNotFoundError as exc:
            raise RuntimeError("miiocli wurde nicht gefunden. Bitte python-miio installieren.") from exc
        last_result = result
        if result.returncode == 0:
            return result
    return last_result


def _build_command(args):
    ip = args.ip
    token = args.token
    event = args.event
    module = args.module

    if event == "info":
        return ["miiocli", "device", "--ip", ip, "--token", token, "info"]

    if event in ("status", "actions"):
        return ["miiocli", module, "--ip", ip, "--token", token, event]

    if event == "set":
        if not args.params:
            raise ValueError("set benoetigt --params (z. B. '{\"property\":\"light:brightness\",\"value\":10}')")
        payload = json.loads(args.params)
        if isinstance(payload, dict):
            prop = payload.get("property")
            value = payload.get("value")
        elif isinstance(payload, list) and len(payload) >= 2:
            prop = payload[0]
            value = payload[1]
        else:
            raise ValueError("set erwartet JSON Objekt oder Array mit [property, value]")
        if prop is None:
            raise ValueError("set benoetigt property")
        return ["miiocli", module, "--ip", ip, "--token", token, "set", str(prop), str(value)]

    if event == "call":
        if not args.params:
            raise ValueError("call benoetigt --params (z. B. '{\"action\":\"light:toggle\"}')")
        payload = json.loads(args.params)
        if isinstance(payload, dict):
            action = payload.get("action")
            params = payload.get("params", [])
        elif isinstance(payload, list) and len(payload) >= 1:
            action = payload[0]
            params = payload[1:]
        else:
            raise ValueError("call erwartet JSON Objekt oder Array mit [action, ...]")
        if action is None:
            raise ValueError("call benoetigt action")
        cmd = ["miiocli", module, "--ip", ip, "--token", token, "call", str(action)]
        for param in params:
            cmd.append(str(param))
        return cmd

    if event == "raw":
        if not args.params:
            raise ValueError("raw benoetigt --params (JSON Array mit Subcommand und Args)")
        payload = json.loads(args.params)
        if not isinstance(payload, list) or not payload:
            raise ValueError("raw erwartet JSON Array mit Subcommand und Args")
        cmd = ["miiocli", module, "--ip", ip, "--token", token]
        if args.model:
            cmd.extend(["--model", args.model])
        cmd.extend([str(p) for p in payload])
        return cmd

    raise ValueError(f"unbekanntes event '{event}'")


def main():
    parser = argparse.ArgumentParser(
        description="MiIO Controller: miiocli Befehle ausfuehren und JSON ausgeben."
    )
    parser.add_argument("--ip", required=True, help="IP-Adresse des Geraets")
    parser.add_argument("--token", required=True, help="Token des Geraets")
    parser.add_argument("--event", required=True, help="info|status|actions|set|call|raw")
    parser.add_argument("--module", default="genericmiot", help="miiocli Modul (z. B. genericmiot)")
    parser.add_argument("--model", help="Optional: Modell fuer alte miIO Geraete")
    parser.add_argument("--params", help="JSON-String fuer set/call/raw")
    args = parser.parse_args()

    try:
        cmd = _build_command(args)
        result = _run_miiocli(cmd)
        if result is None:
            raise RuntimeError("miiocli konnte nicht ausgefuehrt werden.")

        stdout = (result.stdout or "").strip()
        stderr = (result.stderr or "").strip()

        if result.returncode != 0:
            raise RuntimeError(stderr or "miiocli Aufruf fehlgeschlagen.")
        if not stdout:
            raise RuntimeError("miiocli hat keine Daten geliefert.")

        try:
            payload = _parse_json(stdout)
        except json.JSONDecodeError:
            payload = _parse_text(stdout)

        _emit_json(payload)
    except Exception as exc:
        _emit_json({"ok": False, "error": str(exc)})
        sys.exit(1)


if __name__ == "__main__":
    main()

