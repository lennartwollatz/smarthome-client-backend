#!/usr/bin/env python3
import argparse
import asyncio
import json
import sys

from miio import DeviceFactory, PushServer
from miio.push_server import EventInfo


def _emit_json(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=True))
    sys.stdout.write("\n")
    sys.stdout.flush()


def _build_event_info(args, token):
    event_info_kwargs = {
        "action": args.action,
        "extra": args.extra,
        "trigger_token": token,
    }

    if args.source_sid:
        event_info_kwargs["source_sid"] = args.source_sid
    if args.source_model:
        event_info_kwargs["source_model"] = args.source_model

    return EventInfo(**event_info_kwargs)


async def _run(args):
    device = DeviceFactory.create(args.ip, args.token)
    push_server = PushServer(args.ip)

    def callback(source_device, action, params):
        _emit_json({
            "event": "miio_event",
            "source_device": source_device,
            "action": action,
            "params": params,
        })

    await push_server.start()
    push_server.register_miio_device(device, callback)

    event_info = _build_event_info(args, device.token)
    await push_server.subscribe_event(device, event_info)

    _emit_json({
        "event": "subscribed",
        "ok": True,
        "payload": {
            "ip": args.ip,
            "action": args.action,
            "extra": args.extra,
            "source_sid": args.source_sid,
            "source_model": args.source_model,
        },
    })

    stop_event = asyncio.Event()
    try:
        await stop_event.wait()
    except asyncio.CancelledError:
        pass
    finally:
        await push_server.stop()


def main():
    parser = argparse.ArgumentParser(
        description="MiIO Push-Server: Events abonnieren und als JSON auf stdout ausgeben."
    )
    parser.add_argument("--ip", required=True, help="IP-Adresse des Geraets")
    parser.add_argument("--token", required=True, help="Token des Geraets")
    parser.add_argument("--action", required=True, help="Event-Action (z.B. open)")
    parser.add_argument("--extra", required=True, help="Event-Extra (aus der Szene/Trace)")
    parser.add_argument("--source-sid", help="Optional: source_sid fuer Sub-Devices")
    parser.add_argument("--source-model", help="Optional: source_model fuer Sub-Devices")
    args = parser.parse_args()

    try:
        asyncio.run(_run(args))
    except KeyboardInterrupt:
        _emit_json({"event": "stopped", "ok": True})
    except Exception as exc:
        _emit_json({"event": "error", "ok": False, "payload": str(exc)})
        sys.exit(1)


if __name__ == "__main__":
    main()

