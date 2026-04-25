#!/usr/bin/env python3
import argparse
import binascii
import json
import socket
import sys
import time
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)
try:
    from cryptography.utils import CryptographyDeprecationWarning
except ImportError:
    pass
else:
    warnings.filterwarnings("ignore", category=CryptographyDeprecationWarning)

from pywebostv.connection import WebOSClient
from pywebostv.controls import (
    ApplicationControl,
    InputControl,
    MediaControl,
    SourceControl,
    SystemControl,
    TvControl,
    WebOSControlBase,
    standard_validation,
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

# Default-Timeout für die meisten Calls (pywebostv-Default ist 60s).
DEFAULT_REQUEST_TIMEOUT = 60

# Bestimmte WebOS-APIs antworten unter Last häufig erst spät oder mit serverseitigem
# „Timeout.“ — vor allem die App-Liste. Wir geben diesen Calls deutlich mehr Zeit
# und versuchen sie bei „Timeout.“ ein paar Mal erneut.
SLOW_CALL_TIMEOUTS = {
    "application.list_apps": 90,
    "tv.channel_list": 75,
}

# Anzahl Retries bei serverseitigem WebOS-Timeout („Timeout.“ als errorText).
SLOW_CALL_RETRIES = {
    "application.list_apps": 2,
    "tv.channel_list": 2,
}

# Pause zwischen Retries bei serverseitigem Timeout.
SLOW_CALL_RETRY_DELAY_S = 2.0


def _serialize_value(value):
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize_value(val) for key, val in value.items()}
    if hasattr(value, "data"):
        return _serialize_value(value.data)
    return value


def _emit_json(payload):
    # Zeilenende: Node-Parser kann sonst stdout mit anderem Text zuverlässiger splitten.
    sys.stdout.write(json.dumps(_serialize_value(payload)) + "\n")
    sys.stdout.flush()


def _parse_params(params_raw):
    if params_raw is None or params_raw == "":
        return None
    try:
        return json.loads(params_raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"params must be valid JSON: {exc}") from exc


def _send_wol(mac, broadcast="192.168.178.255", port=9):
    cleaned = mac.replace(":", "").replace("-", "").strip()
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


# WebOS antwortet oft mit returnValue=false / „500 Application error“, wenn die API hier
# nicht anwendbar ist (z. B. kein TV-Tuner: HDMI, Streaming-App, Home). Das ist kein Verbindungsfehler.
_BENIGN_500_APPLICATION_EVENTS = frozenset({
    "tv.get_current_channel",
    "tv.get_current_program",
})


def _benign_webos_application_500(event: str, exc: BaseException) -> bool:
    ev = (event or "").strip()
    if ev not in _BENIGN_500_APPLICATION_EVENTS:
        return False
    return "500 application error" in str(exc).lower()


def _should_retry_connection_after_delay(message: str) -> bool:
    """Nur transient network; nicht WebOS „500 Application error“ (Retry würde sinnlos erneut scheitern)."""
    if "[WinError 10054]" in message:
        return True
    lower = message.lower()
    if "500 application error" in lower:
        return False
    return "500" in message


def _is_webos_timeout(exc: BaseException) -> bool:
    """WebOS antwortet bei langsamen Calls (z. B. listApps) oft mit errorText='Timeout.'.
    Das ist kein Verbindungsproblem, sondern serverseitig – ein erneuter Versuch klappt häufig.
    """
    msg = str(exc).strip().lower().rstrip(".")
    return msg == "timeout"


def _list_launch_points(client, timeout):
    """Robuste Alternative zu ``ApplicationControl.list_apps``.

    ``ssap://com.webos.applicationManager/listLaunchPoints`` listet die installierten
    Apps inkl. Icons und liefert deutlich verlässlicher als ``listApps`` Daten zurück
    (``listApps`` neigt unter Last zu serverseitigem ``Timeout.``).
    """
    base = WebOSControlBase(client)
    res = base.request(
        "ssap://com.webos.applicationManager/listLaunchPoints",
        None,
        block=True,
        timeout=timeout,
    )
    if res.get("type") == "error":
        raise IOError(res.get("error", "Unknown Communication Error"))
    payload = res.get("payload") or {}
    status, message = standard_validation(dict(payload))
    if not status:
        raise IOError(message)
    launch_points = payload.get("launchPoints") or []
    apps = []
    for lp in launch_points:
        if not isinstance(lp, dict):
            continue
        # Felder analog zu list_apps (id/title/icon) damit das TS-Backend keine
        # Sonderbehandlung braucht. ``id`` fällt auf ``launchPointId``/``appId`` zurück.
        app_id = lp.get("id") or lp.get("appId") or lp.get("launchPointId")
        if not app_id:
            continue
        apps.append({
            "id": app_id,
            "title": lp.get("title") or lp.get("name") or app_id,
            "icon": lp.get("icon") or lp.get("largeIcon") or lp.get("mediumIcon"),
        })
    return apps


def _list_apps_with_fallback(client, timeout, retries):
    """Versucht zuerst ``listLaunchPoints`` (schnell/robust). Bei serverseitigem
    ``Timeout.`` mehrere Versuche; als letzter Fallback ``ApplicationControl.list_apps``.
    """
    last_exc = None
    for attempt in range(max(retries, 0) + 1):
        if attempt > 0:
            time.sleep(SLOW_CALL_RETRY_DELAY_S)
        try:
            return _list_launch_points(client, timeout)
        except Exception as exc:
            last_exc = exc
            if not _is_webos_timeout(exc):
                break
    try:
        return ApplicationControl(client).list_apps(timeout=timeout)
    except Exception:
        if last_exc is not None:
            raise last_exc
        raise


def _channel_list_with_retry(client, timeout, retries):
    """Ruft ``tv.channel_list`` auf und retried bei serverseitigem ``Timeout.``."""
    last_exc = None
    for attempt in range(max(retries, 0) + 1):
        if attempt > 0:
            time.sleep(SLOW_CALL_RETRY_DELAY_S)
        try:
            return TvControl(client).channel_list(timeout=timeout)
        except Exception as exc:
            last_exc = exc
            if not _is_webos_timeout(exc):
                raise
    assert last_exc is not None
    raise last_exc


def _call_event(client, event, params):
    if "." not in event:
        raise ValueError("event must be in format '<control>.<method>'")

    control_name, method_name = event.split(".", 1)
    control_name = control_name.strip().lower()
    method_name = method_name.strip()

    canonical_event = f"{control_name}.{method_name}"
    timeout = SLOW_CALL_TIMEOUTS.get(canonical_event, DEFAULT_REQUEST_TIMEOUT)
    retries = SLOW_CALL_RETRIES.get(canonical_event, 0)

    if canonical_event == "application.list_apps" and params is None:
        return _list_apps_with_fallback(client, timeout, retries)
    if canonical_event == "tv.channel_list" and params is None:
        return _channel_list_with_retry(client, timeout, retries)

    control_cls = CONTROL_MAP.get(control_name)
    if control_cls is None:
        raise ValueError(f"unknown control '{control_name}'")

    control = control_cls(client)
    method = getattr(control, method_name, None)
    if method is None or not callable(method):
        raise ValueError(f"unknown method '{method_name}' for control '{control_name}'")

    extra_kwargs = {}
    if timeout != DEFAULT_REQUEST_TIMEOUT:
        # pywebostv akzeptiert ``timeout`` für blockierende Calls (siehe controls.exec_command).
        extra_kwargs["timeout"] = timeout

    if params is None:
        return method(**extra_kwargs)
    if isinstance(params, list):
        if method_name == "launch" and len(params) > 0:
            params = list(params)
            params[0] = Application({"id": params[0]})
        return method(*params, **extra_kwargs)
    if isinstance(params, dict):
        if method_name == "notify" and "message" in params:
            return method(params["message"], **extra_kwargs)
        if method_name == "launch" and "id" in params:
            params = dict(params)
            app_id = params.pop("id")
            return method(Application({"id": app_id}), **{**params, **extra_kwargs})
        return method(**{**params, **extra_kwargs})
    if method_name == "launch":
        return method(Application({"id": params}), **extra_kwargs)
    return method(params, **extra_kwargs)


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
            broadcast = params.get("broadcast", "192.168.178.255")
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
        if _benign_webos_application_500(args.event, exc):
            _emit_json({"status": "ok", "result": None})
            return
        message = str(exc)
        if _should_retry_connection_after_delay(message):
            time.sleep(10)
            try:
                _run_once()
                return
            except Exception as retry_exc:
                if _benign_webos_application_500(args.event, retry_exc):
                    _emit_json({"status": "ok", "result": None})
                    return
                _emit_json({"status": "error", "message": str(retry_exc)})
                sys.exit(1)
        _emit_json({"status": "error", "message": message})
        sys.exit(1)


if __name__ == "__main__":
    main()

