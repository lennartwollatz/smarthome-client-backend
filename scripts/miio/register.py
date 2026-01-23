#!/usr/bin/env python3
import argparse
import json
import sys

from miio import DeviceFactory


def _serialize_value(value):
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize_value(val) for key, val in value.items()}
    if hasattr(value, "data"):
        return _serialize_value(value.data)
    if hasattr(value, "__dict__"):
        return _serialize_value(value.__dict__)
    return value


def _emit_json(payload):
    sys.stdout.write(json.dumps(_serialize_value(payload), ensure_ascii=True))
    sys.stdout.write("\n")
    sys.stdout.flush()


def main():
    parser = argparse.ArgumentParser(
        description="Mit python-miio verbinden und Geraeteinfos als JSON ausgeben."
    )
    parser.add_argument("--ip", required=True, help="IP-Adresse des Geraets")
    parser.add_argument("--token", required=True, help="Token des Geraets")
    args = parser.parse_args()

    try:
        device = DeviceFactory.create(args.ip, args.token)
        info = None
        status = None
        sensors = None
        settings = None
        actions = None

        if hasattr(device, "info"):
            info = device.info()
        if hasattr(device, "status"):
            status = device.status()
        if hasattr(device, "sensors"):
            sensors = device.sensors()
        if hasattr(device, "settings"):
            settings = device.settings()
        if hasattr(device, "actions"):
            actions = device.actions()

        _emit_json({
            "ok": True,
            "device": {
                "info": info,
                "status": status,
                "sensors": sensors,
                "settings": settings,
                "actions": actions,
            },
        })
    except Exception as exc:
        _emit_json({"ok": False, "error": str(exc)})
        sys.exit(1)


if __name__ == "__main__":
    main()

