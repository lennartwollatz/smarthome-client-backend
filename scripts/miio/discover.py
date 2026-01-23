#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
import sys


def _run_miiocli_cloud(username, password):
    attempts = [
        ["miiocli", "cloud", "--json"],
        ["miiocli", "cloud", "-j"],
        ["miiocli", "cloud"],
    ]
    stdin_payload = f"{username}\n{password}\n"

    last_result = None
    for cmd in attempts:
        try:
            result = subprocess.run(
                cmd,
                input=stdin_payload,
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


def _parse_json(stdout):
    data = json.loads(stdout.strip())
    if isinstance(data, list):
        devices = data
    elif isinstance(data, dict) and isinstance(data.get("devices"), list):
        devices = data["devices"]
    else:
        devices = [data]
    return {"ok": True, "devices": devices}


def _parse_text(stdout):
    devices = []
    current = None

    title_re = re.compile(r"^==\s*(.*?)\s*==$")
    field_re = re.compile(r"^\s*([A-Za-z0-9 _-]+):\s*(.+)$")

    for line in stdout.splitlines():
        line = line.rstrip()
        if not line:
            continue

        title_match = title_re.match(line)
        if title_match:
            if current:
                devices.append(current)
            title = title_match.group(1).strip()
            status = None
            name = title
            status_match = re.match(r"^(.*?)\s*\((.*?)\)\s*$", title)
            if status_match:
                name = status_match.group(1).strip()
                status = status_match.group(2).strip()
            current = {"name": name}
            if status:
                current["status"] = status
            continue

        if current is None:
            continue

        field_match = field_re.match(line)
        if not field_match:
            continue

        key = field_match.group(1).strip().lower().replace(" ", "_")
        value = field_match.group(2).strip()

        if key == "ip":
            ip_match = re.match(r"^(.*?)\s*\(mac:\s*([^)]+)\)\s*$", value)
            if ip_match:
                current["ip"] = ip_match.group(1).strip()
                current["mac"] = ip_match.group(2).strip()
                continue

        current[key] = value

    if current:
        devices.append(current)

    return {"ok": True, "devices": devices}


def _emit_json(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=True))
    sys.stdout.write("\n")
    sys.stdout.flush()


def main():
    parser = argparse.ArgumentParser(
        description="Login per miiocli und alle Device-Konfigurationen als JSON ausgeben."
    )
    parser.add_argument("--username", required=True, help="Xiaomi Cloud Benutzername")
    parser.add_argument("--password", required=True, help="Xiaomi Cloud Passwort")
    args = parser.parse_args()

    try:
        result = _run_miiocli_cloud(args.username, args.password)
        if result is None:
            raise RuntimeError("miiocli konnte nicht ausgefuehrt werden.")

        stdout = (result.stdout or "").strip()
        stderr = (result.stderr or "").strip()

        if result.returncode != 0:
            raise RuntimeError(stderr or "miiocli cloud ist fehlgeschlagen.")

        if not stdout:
            raise RuntimeError("miiocli cloud hat keine Daten geliefert.")

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

