#!/usr/bin/env python3
import argparse
import binascii
import json
import socket
import sys
import time

from pywebostv.connection import WebOSClient
from pywebostv.controls import (
    ApplicationControl,
    InputControl,
    MediaControl,
    SourceControl,
    SystemControl,
    TvControl,
)
from pywebostv.model import Application


CONTROL_MAP = {
    "application": ApplicationControl,
    "input": InputControl,
    "media": MediaControl,
    "source": SourceControl,
    "system": SystemControl,
    "tv": TvControl,
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
    sys.stdout.flush()


def _parse_params(params_raw):
    if params_raw is None or params_raw == "":
        return None
    try:
        return json.loads(params_raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"params must be valid JSON: {exc}") from exc


def _send_wol(mac, broadcast="255.255.255.255", port=9):
    cleaned = mac.replace(":", "").replace("-", "")
    if len(cleaned) != 12:
        raise ValueError("mac must be 12 hex chars (e.g. AA:BB:CC:DD:EE:FF)")
    data = "FF" * 6 + cleaned * 16
    packet = binascii.unhexlify(data)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.sendto(packet, (broadcast, port))
    finally:
        sock.close()


def _call_event(client, event, params):
    if "." not in event:
        raise ValueError("event must be in format '<control>.<method>'")

    control_name, method_name = event.split(".", 1)
    control_name = control_name.strip().lower()
    method_name = method_name.strip()

    control_cls = CONTROL_MAP.get(control_name)
    if control_cls is None:
        raise ValueError(f"unknown control '{control_name}'")

    control = control_cls(client)
    method = getattr(control, method_name, None)
    if method is None or not callable(method):
        raise ValueError(f"unknown method '{method_name}' for control '{control_name}'")

    if params is None:
        return method()
    if isinstance(params, list):
        if method_name == "launch" and len(params) > 0:
            params = list(params)
            params[0] = Application({"id": params[0]})
        return method(*params)
    if isinstance(params, dict):
        if method_name == "notify" and "message" in params:
            return method(params["message"])
        if method_name == "launch" and "id" in params:
            params = dict(params)
            app_id = params.pop("id")
            return method(Application({"id": app_id}), **params)
        return method(**params)
    if method_name == "launch":
        return method(Application({"id": params}))
    return method(params)


def main():
    parser = argparse.ArgumentParser(description="PyWebOSTV controller entrypoint.")
    parser.add_argument("--ip", required=True, help="IP address of the LG TV")
    parser.add_argument("--client-key", default=None, help="Existing client key")
    parser.add_argument("--event", required=True, help="Event in format '<control>.<method>'")
    parser.add_argument("--params", default=None, help="JSON array/object/value with parameters")
    args = parser.parse_args()

    def _run_once():
        params = _parse_params(args.params)

        if args.event.strip().lower() == "wol":
            if not isinstance(params, dict) or "mac" not in params:
                raise ValueError("params must be JSON object with key 'mac'")
            broadcast = params.get("broadcast", "255.255.255.255")
            port = int(params.get("port", 9))
            _send_wol(params["mac"], broadcast=broadcast, port=port)
            _emit_json({"status": "ok", "result": "wol_sent"})
            return

        if not args.client_key:
            raise ValueError("client-key is required for non-wol events")

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

        result = _call_event(client, args.event, params)
        _emit_json({"status": "ok", "result": result})

    try:
        _run_once()
    except Exception as exc:
        message = str(exc)
        if "[WinError 10054]" in message or "500" in message:
            time.sleep(10)
            try:
                _run_once()
                return
            except Exception as retry_exc:
                _emit_json({"status": "error", "message": str(retry_exc)})
                sys.exit(1)
        _emit_json({"status": "error", "message": message})
        sys.exit(1)


if __name__ == "__main__":
    main()

