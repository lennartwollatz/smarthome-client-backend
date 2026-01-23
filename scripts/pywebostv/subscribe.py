#!/usr/bin/env python3
import argparse
import json
import sys
import threading

from pywebostv.connection import WebOSClient
from pywebostv.controls import ApplicationControl, MediaControl, SystemControl, TvControl


EVENT_MAP = {
    "app.current": ("application", "subscribe_get_current"),
    "volume": ("media", "subscribe_get_volume"),
    "audio_output": ("media", "subscribe_get_audio_output"),
    "channel.current": ("tv", "subscribe_get_current_channel"),
}


def _serialize_value(value):
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize_value(val) for key, val in value.items()}
    if hasattr(value, "data"):
        return _serialize_value(value.data)
    return value


def _emit_json(payload):
    sys.stdout.write(json.dumps(_serialize_value(payload)))
    sys.stdout.write("\n")
    sys.stdout.flush()


def _build_control(client, name):
    if name == "application":
        return ApplicationControl(client)
    if name == "media":
        return MediaControl(client)
    if name == "system":
        return SystemControl(client)
    if name == "tv":
        return TvControl(client)
    raise ValueError(f"unknown control '{name}'")


def _subscribe(control, method_name, event_name):
    method = getattr(control, method_name, None)
    if method is None or not callable(method):
        raise ValueError(f"unknown method '{method_name}' for {event_name}")

    def handler(status, payload):
        _emit_json({
            "event": event_name,
            "ok": bool(status),
            "payload": payload,
        })

    method(handler)


def main():
    parser = argparse.ArgumentParser(description="PyWebOSTV subscription entrypoint.")
    parser.add_argument("--ip", required=True, help="IP address of the LG TV")
    parser.add_argument("--client-key", required=True, help="Existing client key")
    parser.add_argument(
        "--events",
        default="all",
        help="Comma separated events or 'all' (app.current, volume, audio_output, channel.current)",
    )
    args = parser.parse_args()

    events_raw = [e.strip() for e in args.events.split(",") if e.strip()]
    if not events_raw or "all" in events_raw:
        event_names = list(EVENT_MAP.keys())
    else:
        event_names = events_raw

    try:
        store = {"client_key": args.client_key}
        client = WebOSClient(args.ip, secure=True)
        client.connect()
        for status in client.register(store):
            if status == WebOSClient.PROMPTED:
                print("Please accept the connect on the TV!", file=sys.stderr)
            elif status == WebOSClient.REGISTERED:
                break

        if "client_key" not in store:
            raise RuntimeError("Registration finished without client_key.")

        controls = {}
        for event_name in event_names:
            if event_name not in EVENT_MAP:
                raise ValueError(f"unknown event '{event_name}'")
            control_name, method_name = EVENT_MAP[event_name]
            control = controls.get(control_name)
            if control is None:
                control = _build_control(client, control_name)
                controls[control_name] = control
            _subscribe(control, method_name, event_name)

        _emit_json({"event": "subscribed", "ok": True, "payload": event_names})

        stop_event = threading.Event()
        try:
            stop_event.wait()
        except KeyboardInterrupt:
            _emit_json({"event": "stopped", "ok": True})
    except Exception as exc:
        _emit_json({"event": "error", "ok": False, "payload": str(exc)})
        sys.exit(1)


if __name__ == "__main__":
    main()

