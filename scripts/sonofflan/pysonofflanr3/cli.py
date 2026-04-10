import asyncio
import json
import logging
import os
import sys
import threading
from typing import Any, Dict, List, Optional

import click
import click_log
from click_log import ClickHandler

from pysonofflanr3 import SonoffSwitch, Discover
from pysonofflanr3.client import parse_zeroconf_http_response

if sys.version_info < (3, 6):  # pragma: no cover
    print(
        "To use this script you need python 3.6 or newer! got %s"
        % sys.version_info
    )
    sys.exit(1)


class CustomColorFormatter(click_log.ColorFormatter):
    colors = {
        "error": dict(fg="red"),
        "exception": dict(fg="red"),
        "critical": dict(fg="red"),
        "info": dict(fg="bright_green"),
        "debug": dict(fg="blue"),
        "warning": dict(fg="yellow"),
    }

    def format(self, record):
        if not record.exc_info:
            level = record.levelname.lower()
            msg = record.getMessage()

            prefix = self.formatTime(record, self.datefmt) + " - "
            if level in self.colors:
                prefix += click.style(
                    "{}: ".format(level), **self.colors[level]
                )

            msg = "\n".join(prefix + x for x in msg.splitlines())
            return msg
        return logging.Formatter.format(self, record)


logger = logging.getLogger(__name__)
click_log.basic_config(logger)

_default_handler = ClickHandler()
_default_handler.formatter = CustomColorFormatter()

logger.handlers = [_default_handler]

pass_config = click.make_pass_decorator(dict, ensure=True)


def _parse_device_specs_loaded(loaded: Any, source: str) -> List[Dict[str, Any]]:
    """JSON-Array → normalisierte Geräteliste; wirft click.BadParameter bei Fehlern."""
    if not isinstance(loaded, list) or not loaded:
        raise click.BadParameter(
            "%s: Es wird ein nicht leeres JSON-Array erwartet." % source
        )
    for i, row in enumerate(loaded):
        if not isinstance(row, dict):
            raise click.BadParameter(
                "%s[%s]: JSON-Objekt erwartet." % (source, i)
            )
        for key in ("host", "device_id"):
            if not row.get(key):
                raise click.BadParameter(
                    "%s[%s]: '%s' fehlt oder ist leer." % (source, i, key)
                )
        if "api_key" not in row:
            row["api_key"] = ""
        if "outlet" in row and row["outlet"] is not None:
            row["outlet"] = int(row["outlet"])
    return loaded


def apply_loglevel(root: logging.Logger, level_name: str) -> None:
    ln = (level_name or "INFO").strip().upper()
    if ln == "OFF":
        root.handlers.clear()
        root.addHandler(logging.NullHandler())
        root.setLevel(logging.CRITICAL + 1)
        for name in ("pysonofflanr3", "urllib3", "zeroconf"):
            logging.getLogger(name).handlers.clear()
            logging.getLogger(name).addHandler(logging.NullHandler())
            logging.getLogger(name).setLevel(logging.CRITICAL + 1)
        return
    level = getattr(logging, ln, logging.INFO)
    root.setLevel(level)


_stdout_lock = threading.Lock()


def json_stdout_only(obj: object) -> None:
    line = json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"
    with _stdout_lock:
        sys.stdout.write(line)
        sys.stdout.flush()


def json_stdout_error(message: str) -> None:
    json_stdout_only({"ok": False, "error": message})


def json_stdout_ok(ok: bool) -> None:
    """Eine Zeile `{"ok":true|false}` für Schaltbefehle (switch / on / off)."""
    json_stdout_only({"ok": bool(ok)})


def _new_cli_one_shot():
    """
    Nur die erste erfolgreich ankommende Callback-Instanz führt aus
    (weitere mDNS-Updates während eines HTTP-Calls sonst doppelt).
    """
    lock = asyncio.Lock()
    taken = False

    async def take() -> bool:
        nonlocal taken
        async with lock:
            if taken:
                return False
            taken = True
            return True

    return take


def _switch_from_switches_list(
    switches: list, outlet: Optional[int]
) -> Optional[str]:
    if not switches:
        return None
    if outlet is not None:
        for ent in switches:
            if isinstance(ent, dict) and int(ent.get("outlet", -1)) == int(
                outlet
            ):
                return ent.get("switch")
    ent0 = switches[0]
    if isinstance(ent0, dict):
        return ent0.get("switch")
    return None


def _switches_from_parsed(parsed: Optional[dict]) -> Optional[list]:
    """``switches`` im Klartext (Root, oder unter ``params`` wie Cloud-API)."""
    if not parsed or not isinstance(parsed, dict):
        return None
    sw = parsed.get("switches")
    if isinstance(sw, list):
        return sw
    params = parsed.get("params")
    if isinstance(params, dict):
        sw2 = params.get("switches")
        if isinstance(sw2, list):
            return sw2
    return None


async def _http_switches_query(
    device: SonoffSwitch, config: dict
) -> Optional[dict]:
    """
    Kanalzustände per HTTP (multifun_switch, strip).
    Zuerst /zeroconf/getState (SonoffLAN-Verhalten), Fallback /zeroconf/switches.
    """
    ct = device.client.type
    if ct not in (b"multifun_switch", b"strip"):
        return None
    loop = device.loop
    api = config.get("api_key") or ""

    async def one_shot(send_fn, endpoint_label: str) -> dict:
        try:
            resp = await loop.run_in_executor(None, send_fn)
        except Exception as ex:  # pragma: no cover
            logger.debug("%s failed: %s", endpoint_label, ex)
            return {
                "switches": None,
                "httpOk": False,
                "httpStatus": None,
                "data": None,
                "error": str(ex),
                "endpoint": endpoint_label,
            }
        body = resp.content.decode("utf-8", errors="replace")
        iv = device.client._last_sent_iv or ""
        ok, parsed = parse_zeroconf_http_response(body, iv, api)
        sw = _switches_from_parsed(parsed)
        return {
            "switches": sw,
            "httpOk": ok,
            "httpStatus": resp.status_code,
            "data": parsed,
            "endpoint": endpoint_label,
        }

    def _merge_switches(
        a: Optional[list], b: Optional[list]
    ) -> Optional[list]:
        out: Dict[int, dict] = {}
        for src in (a or []):
            if isinstance(src, dict) and "outlet" in src:
                try:
                    out[int(src.get("outlet", -1))] = dict(src)
                except Exception:
                    pass
        for src in (b or []):
            if isinstance(src, dict) and "outlet" in src:
                try:
                    out[int(src.get("outlet", -1))] = dict(src)
                except Exception:
                    pass
        if not out:
            return None
        return [out[k] for k in sorted(out.keys())]

    meta_get = await one_shot(device.client.send_zeroconf_get_state, "getState")
    meta_sw = await one_shot(device.client.send_empty_zeroconf_switches, "switches")
    merged = _merge_switches(
        meta_get.get("switches"),
        meta_sw.get("switches"),
    )
    if merged:
        # Für multifun/strip immer die vollständigste bekannte Kanalliste liefern.
        best = meta_sw if len(meta_sw.get("switches") or []) >= len(meta_get.get("switches") or []) else meta_get
        best["switches"] = merged
        best["tried"] = ["getState", "switches"]
        return best

    # Beide ohne Kanalliste: letzten Versuch melden, erste Antwort als Referenz
    out = dict(meta_sw)
    out["fallback"] = meta_get
    out["tried"] = ["getState", "switches"]
    return out


def _is_dualr3(device: SonoffSwitch) -> bool:
    """
    DUALR3 (eWeLink uiid 126) ist ``multifun_switch`` mit Energiemessung;
    /zeroconf/statistics liefert dort sinnvolle Zusatzdaten zu getState.
    """
    if device.client.type != b"multifun_switch":
        return False
    bi = device.basic_info
    if not bi or not isinstance(bi, dict):
        return False
    uiid = bi.get("uiid")
    try:
        if uiid is not None and int(uiid) == 126:
            return True
    except (TypeError, ValueError):
        pass
    blob = json.dumps(bi, ensure_ascii=False, default=str).lower().replace(" ", "")
    if "dualr3" in blob or "dual_r3" in blob:
        return True
    return False


async def _http_statistics_meta(device: SonoffSwitch, config: dict) -> dict:
    """Ein /zeroconf/statistics-Request; Rückgabe wie ``statistics``-CLI (ohne Prozessende)."""
    loop = device.loop
    api = config.get("api_key") or ""
    try:
        resp = await loop.run_in_executor(None, device.client.send_statistics)
    except Exception as ex:  # pragma: no cover
        logger.debug("statistics failed: %s", ex)
        return {
            "ok": False,
            "httpStatus": None,
            "data": None,
            "error": str(ex),
        }
    body = resp.content.decode("utf-8", errors="replace")
    iv = device.client._last_sent_iv or ""
    ok, parsed = parse_zeroconf_http_response(body, iv, api)
    return {
        "ok": ok,
        "httpStatus": resp.status_code,
        "data": parsed,
    }


def _zeroconf_http_emit_result(device: SonoffSwitch, config: dict, resp) -> None:
    body = resp.content.decode("utf-8", errors="replace")
    iv = device.client._last_sent_iv or ""
    ok, parsed = parse_zeroconf_http_response(
        body, iv, config.get("api_key") or ""
    )
    if _machine_mode(config):
        json_stdout_only(
            {"ok": ok, "httpStatus": resp.status_code, "data": parsed}
        )
    else:
        logger.info("Zeroconf HTTP %s ok=%s", resp.status_code, ok)
        if parsed is not None:
            logger.debug(
                "%s", json.dumps(parsed, ensure_ascii=False, indent=2)
            )


@click.group(invoke_without_command=True)
@click.option(
    "--host",
    envvar="PYSONOFFLAN_HOST",
    required=False,
    help="IP address or hostname of the device to connect to.",
)
@click.option(
    "--device_id",
    envvar="PYSONOFFLAN_device_id",
    required=False,
    help="Device ID of the device to connect to.",
)
@click.option(
    "--api_key",
    envvar="PYSONOFFLAN_api_key",
    required=False,
    help="api key for the device to connect to.",
)
@click.option(
    "--outlet",
    type=int,
    default=None,
    help="Kanal/outlet index (Multikanal, DUALR3, strip, …).",
)
@click.option(
    "--inching",
    envvar="PYSONOFFLAN_inching",
    required=False,
    help='Number of seconds of "on" time if this is an '
    "Inching/Momentary switch.",
)
@click.option(
    "--wait",
    envvar="PYSONOFFLAN_wait",
    required=False,
    type=int,
    help="(listen --follow) nach N Updates beenden.",
)
@click.option(
    "-l",
    "--loglevel",
    default="INFO",
    show_default=True,
    type=str,
    help="DEBUG|INFO|… oder OFF (keine Logs; Maschinen-JSON nur auf stdout).",
)
@click.option(
    "--devices",
    "devices_path",
    type=click.Path(exists=True, dir_okay=False),
    default=None,
    help=(
        "JSON-Datei (Array): parallele get-state/getState-Aufrufe. "
        "Eintrag: host, device_id, api_key (optional), outlet (optional)."
    ),
)
@click.option(
    "--devices-stdin",
    "devices_stdin",
    is_flag=True,
    default=False,
    help=(
        "Geräteliste als JSON-Array von stdin (Node Backend). "
        "Schließt --devices aus."
    ),
)
@click.pass_context
@click.version_option()
def cli(
    ctx,
    host,
    device_id,
    api_key,
    outlet,
    inching,
    wait,
    loglevel,
    devices_path,
    devices_stdin,
):
    """CLI für Sonoff LAN Mode (R3 / Zeroconf)."""
    apply_loglevel(logger, loglevel)

    if devices_path and devices_stdin:
        raise click.UsageError(
            "Nur eine Quelle für mehrere Geräte: --devices oder --devices-stdin."
        )

    device_specs: Optional[List[Dict[str, Any]]] = None
    if devices_path:
        try:
            with open(devices_path, encoding="utf-8") as f:
                loaded = json.load(f)
        except (OSError, json.JSONDecodeError) as ex:
            raise click.BadParameter("--devices: %s" % ex) from ex
        device_specs = _parse_device_specs_loaded(loaded, "--devices")
    elif devices_stdin:
        try:
            raw = sys.stdin.read()
            loaded = json.loads(raw) if raw.strip() else None
        except json.JSONDecodeError as ex:
            raise click.BadParameter("--devices-stdin: %s" % ex) from ex
        device_specs = _parse_device_specs_loaded(loaded, "--devices-stdin")
    else:
        env_json = os.environ.get("PYSONOFFLAN_DEVICES_JSON", "").strip()
        if env_json:
            try:
                loaded = json.loads(env_json)
            except json.JSONDecodeError as ex:
                raise click.BadParameter(
                    "PYSONOFFLAN_DEVICES_JSON: %s" % ex
                ) from ex
            device_specs = _parse_device_specs_loaded(
                loaded, "PYSONOFFLAN_DEVICES_JSON"
            )

    if ctx.invoked_subcommand == "discover":
        return

    if device_specs is not None:
        sub = ctx.invoked_subcommand
        if sub not in ("get-state", "getState"):
            raise click.UsageError(
                "Mehrere Geräte (--devices, --devices-stdin, "
                "PYSONOFFLAN_DEVICES_JSON) nur mit get-state oder getState."
            )

    if device_specs is None and host is None and device_id is None:
        logger.error("No host name or device_id given, see usage below:")
        click.echo(ctx.get_help())
        sys.exit(1)

    ctx.obj = {
        "host": host,
        "device_id": device_id,
        "api_key": api_key,
        "outlet": outlet,
        "inching": inching,
        "wait": wait,
        "loglevel": loglevel,
        "device_specs": device_specs,
    }


@cli.command()
def discover():
    """Discover devices in the network (takes ~1 minute)."""
    logger.info(
        "Attempting to discover Sonoff LAN Mode devices "
        "on the local network, please wait..."
    )
    found_devices = (
        asyncio.get_event_loop()
        .run_until_complete(Discover.discover(logger))
        .items()
    )
    for found_device_id, ip in found_devices:
        logger.debug(
            "Found Sonoff LAN Mode device %s at socket %s"
            % (found_device_id, ip)
        )


def _machine_mode(config: dict) -> bool:
    return (config.get("loglevel") or "").strip().upper() == "OFF"


@cli.command("statistics")
@pass_config
def statistics_cmd(config: dict):
    """POST /zeroconf/statistics; eine kompakte JSON-Zeile auf stdout (auch bei DEBUG)."""
    take = _new_cli_one_shot()

    async def cb(device: SonoffSwitch):
        if device.basic_info is None:
            return
        if not await take():
            return
        loop = device.loop
        try:
            resp = await loop.run_in_executor(
                None, device.client.send_statistics
            )
        except Exception as ex:  # pragma: no cover
            if _machine_mode(config):
                json_stdout_error(str(ex))
            else:
                logger.exception("statistics request failed")
        else:
            body = resp.content.decode("utf-8", errors="replace")
            iv = device.client._last_sent_iv or ""
            ok, parsed = parse_zeroconf_http_response(
                body, iv, config.get("api_key") or ""
            )
            json_stdout_only(
                {"ok": ok, "httpStatus": resp.status_code, "data": parsed}
            )
            if not _machine_mode(config):
                logger.info(
                    "statistics HTTP %s ok=%s", resp.status_code, ok
                )
                if parsed is not None:
                    logger.debug(
                        "%s",
                        json.dumps(parsed, ensure_ascii=False, indent=2),
                    )
        device.shutdown_event_loop()

    SonoffSwitch(
        host=config["host"],
        callback_after_update=cb,
        logger=logger,
        device_id=config["device_id"],
        api_key=config["api_key"],
        outlet=config["outlet"],
    )


@cli.command("switch")
@click.argument(
    "switch_arg",
    type=click.Choice(["on", "off", "toggle"]),
)
@pass_config
def switch_zeroconf(config: dict, switch_arg: str):
    """Schaltet über Zeroconf (wie on/off, inkl. strip/multifun_switch -> /switches)."""
    take = _new_cli_one_shot()

    async def cb(device: SonoffSwitch):
        if device.basic_info is None:
            return
        if not device.available:
            return
        if not await take():
            return
        loop = device.loop
        params = {"switch": switch_arg}
        payload = device.client.get_update_payload(device.device_id, params)
        try:
            resp = await loop.run_in_executor(
                None, device.client.send_switch, payload
            )
        except Exception as ex:  # pragma: no cover
            json_stdout_ok(False)
            if _machine_mode(config):
                pass
            else:
                logger.exception("switch POST failed")
            device.shutdown_event_loop()
            return
        body = resp.content.decode("utf-8", errors="replace")
        iv = device.client._last_sent_iv or ""
        ok, parsed = parse_zeroconf_http_response(
            body, iv, config.get("api_key") or ""
        )
        json_stdout_ok(ok)
        if not _machine_mode(config):
            if parsed is not None:
                logger.debug(
                    "switch Zeroconf HTTP %s ok=%s — %s",
                    resp.status_code,
                    ok,
                    json.dumps(parsed, ensure_ascii=False)[:500],
                )
            print_device_details(device)
        device.shutdown_event_loop()

    SonoffSwitch(
        host=config["host"],
        callback_after_update=cb,
        logger=logger,
        device_id=config["device_id"],
        api_key=config["api_key"],
        outlet=config["outlet"],
    )


@cli.command("brightness")
@click.argument("level", type=int)
@click.argument(
    "switch_arg",
    type=click.Choice(["on", "off"]),
)
@pass_config
def brightness_zeroconf(config: dict, level: int, switch_arg: str):
    """Helligkeit 0–100 per LAN (plug: /zeroconf/brightness, sonst /zeroconf/dimmable)."""
    take = _new_cli_one_shot()
    level = max(0, min(100, int(level)))

    async def cb(device: SonoffSwitch):
        if device.basic_info is None:
            return
        if not device.available:
            return
        if not await take():
            return
        loop = device.loop
        params = {
            "switch": switch_arg,
            "brightness": level,
            "mode": 0,
        }
        payload = device.client.get_update_payload(device.device_id, params)
        try:
            resp = await loop.run_in_executor(
                None, device.client.send_dimmable, payload
            )
        except Exception as ex:  # pragma: no cover
            json_stdout_ok(False)
            if not _machine_mode(config):
                logger.exception("dimmable POST failed")
            device.shutdown_event_loop()
            return
        body = resp.content.decode("utf-8", errors="replace")
        iv = device.client._last_sent_iv or ""
        ok, parsed = parse_zeroconf_http_response(
            body, iv, config.get("api_key") or ""
        )
        json_stdout_ok(ok)
        if not _machine_mode(config):
            if parsed is not None:
                logger.debug(
                    "brightness Zeroconf HTTP %s ok=%s — %s",
                    resp.status_code,
                    ok,
                    json.dumps(parsed, ensure_ascii=False)[:500],
                )
            print_device_details(device)
        device.shutdown_event_loop()

    SonoffSwitch(
        host=config["host"],
        callback_after_update=cb,
        logger=logger,
        device_id=config["device_id"],
        api_key=config["api_key"],
        outlet=config["outlet"],
    )


@cli.command("switches")
@pass_config
def switches_zeroconf(config: dict):
    """Leerer POST /zeroconf/switches; eine JSON-Zeile auf stdout (auch bei DEBUG)."""
    take = _new_cli_one_shot()

    async def cb(device: SonoffSwitch):
        if device.basic_info is None:
            return
        if not await take():
            return
        loop = device.loop
        try:
            resp = await loop.run_in_executor(
                None, device.client.send_empty_zeroconf_switches
            )
        except Exception as ex:  # pragma: no cover
            if _machine_mode(config):
                json_stdout_error(str(ex))
            else:
                logger.exception("switches request failed")
        else:
            body = resp.content.decode("utf-8", errors="replace")
            iv = device.client._last_sent_iv or ""
            ok, parsed = parse_zeroconf_http_response(
                body, iv, config.get("api_key") or ""
            )
            json_stdout_only(
                {"ok": ok, "httpStatus": resp.status_code, "data": parsed}
            )
            if not _machine_mode(config):
                logger.info("switches HTTP %s ok=%s", resp.status_code, ok)
                if parsed is not None:
                    logger.debug(
                        "%s",
                        json.dumps(parsed, ensure_ascii=False, indent=2),
                    )
        device.shutdown_event_loop()

    SonoffSwitch(
        host=config["host"],
        callback_after_update=cb,
        logger=logger,
        device_id=config["device_id"],
        api_key=config["api_key"],
        outlet=config["outlet"],
    )


async def _build_state_payload(
    device: SonoffSwitch, config: dict, *, live: bool = False
) -> dict:
    """
    mDNS basic_info + bei multifun/strip HTTP getState (Fallback switches).
    DUALR3 ohne ``--live``: ``statistics`` im selben JSON.
    Mit ``--live``: keine Einbettung hier; zweite stdout-Zeile (``streamPart`` ``statistics``)
    kommt immer separat in ``_run_get_state``.
    """
    http_meta = await _http_switches_query(device, config)
    switches = http_meta["switches"] if http_meta else None
    basic = dict(device.basic_info)
    if device.client.type == b"multifun_switch":
        # Für multifun_switch immer beide Outlets (0/1) im Array liefern.
        # Falls einer fehlt, als Platzhalter mit `switch: None` ergänzen.
        merged_by_outlet: Dict[int, dict] = {}
        for src in (switches or []):
            if isinstance(src, dict) and "outlet" in src:
                try:
                    merged_by_outlet[int(src.get("outlet", -1))] = dict(src)
                except Exception:
                    pass
        basic_switches = basic.get("switches")
        if isinstance(basic_switches, list):
            for src in basic_switches:
                if isinstance(src, dict) and "outlet" in src:
                    try:
                        out = int(src.get("outlet", -1))
                        if out not in merged_by_outlet:
                            merged_by_outlet[out] = dict(src)
                    except Exception:
                        pass
        for out in (0, 1):
            if out not in merged_by_outlet:
                merged_by_outlet[out] = {"outlet": out, "switch": None}
        switches = [merged_by_outlet[k] for k in (0, 1)]

    if switches:
        basic["switches"] = switches
    outlet = config.get("outlet")
    sw_one = _switch_from_switches_list(switches, outlet)
    if sw_one is not None:
        device.params = {"switch": sw_one}
    payload = {
        "ok": True,
        "switch": device.params.get("switch"),
        "switches": switches,
        "basicInfo": basic,
    }
    if http_meta:
        zs = {
            "ok": http_meta.get("httpOk"),
            "httpStatus": http_meta.get("httpStatus"),
            "data": http_meta.get("data"),
        }
        if http_meta.get("endpoint"):
            zs["endpoint"] = http_meta["endpoint"]
        if http_meta.get("tried"):
            zs["tried"] = http_meta["tried"]
        if http_meta.get("fallback"):
            zs["fallback"] = http_meta["fallback"]
        if http_meta.get("error"):
            zs["error"] = http_meta["error"]
        payload["zeroconfSwitches"] = zs

    if not live and _is_dualr3(device):
        payload["statistics"] = await _http_statistics_meta(device, config)

    return payload


def _merge_device_row(global_config: dict, row: dict) -> dict:
    """Einzelnes Gerät aus --devices-Zeile + gemeinsame CLI-Optionen (loglevel, wait, …)."""
    return {
        "host": row["host"],
        "device_id": row["device_id"],
        "api_key": row.get("api_key") or "",
        "outlet": row.get("outlet"),
        "inching": global_config.get("inching"),
        "wait": global_config.get("wait"),
        "loglevel": global_config.get("loglevel"),
        "device_specs": None,
    }


def _mdns_seq_from_device(device: SonoffSwitch) -> Optional[str]:
    try:
        props = device.client.properties
        if not props:
            return None
        raw = props.get(b"seq")
        if raw is None:
            return None
        if isinstance(raw, bytes):
            return raw.decode("utf-8", errors="replace")
        return str(raw)
    except Exception:  # pragma: no cover
        return None


def _run_get_state_parallel(
    specs: List[Dict[str, Any]], global_config: dict, live: bool
) -> None:
    if len(specs) == 1:
        _run_get_state(_merge_device_row(global_config, specs[0]), live)
        return
    threads = []
    for row in specs:
        cfg = _merge_device_row(global_config, row)
        t = threading.Thread(
            target=_run_get_state,
            args=(cfg, live),
            daemon=True,
            name="sonoff-%s" % cfg["device_id"],
        )
        threads.append(t)
        t.start()
    for t in threads:
        t.join()


def _dispatch_get_state(config: dict, live: bool) -> None:
    specs = config.get("device_specs")
    if specs:
        _run_get_state_parallel(specs, config, live)
    else:
        _run_get_state(config, live)


def _run_get_state(config: dict, live: bool = False) -> None:
    take = None if live else _new_cli_one_shot()
    counter = {"n": 0}

    async def cb(device: SonoffSwitch):
        if device.basic_info is None:
            return
        if take is not None and not await take():
            return
        payload = await _build_state_payload(device, config, live=live)
        try:
            payload["ewelinkDeviceId"] = device.device_id
        except Exception:  # pragma: no cover
            pass
        seq = None
        if live:
            counter["n"] += 1
            payload["live"] = True
            payload["n"] = counter["n"]
            seq = _mdns_seq_from_device(device)
            if seq is not None:
                payload["mdnsSeq"] = seq
        json_stdout_only(payload)
        if live:
            stats = await _http_statistics_meta(device, config)
            stats_line = dict(stats)
            stats_line["live"] = True
            stats_line["n"] = counter["n"]
            stats_line["streamPart"] = "statistics"
            try:
                stats_line["ewelinkDeviceId"] = device.device_id
            except Exception:  # pragma: no cover
                pass
            if seq is not None:
                stats_line["mdnsSeq"] = seq
            json_stdout_only(stats_line)
        human = not _machine_mode(config) and not live
        if human:
            print_device_details(
                device,
                switches_override=payload.get("switches"),
            )
        if not live:
            device.shutdown_event_loop()

    SonoffSwitch(
        host=config["host"],
        callback_after_update=cb,
        logger=logger,
        device_id=config["device_id"],
        api_key=config["api_key"],
        outlet=config["outlet"],
        emit_every_multifun_telemetry=live,
        emit_all_mdns_updates=live,
    )


@cli.command("get-state")
@click.option(
    "--live",
    is_flag=True,
    help=(
        "Pro empfangenem mDNS-Status zwei JSON-Zeilen: getState-Payload, danach /zeroconf/statistics "
        "(zweite Zeile mit streamPart=statistics). Ende mit Strg+C. Ohne --live: einmalig wie bisher."
    ),
)
@pass_config
def get_state(config: dict, live: bool):
    """Zustand inkl. Kanäle; --live für Stream. --devices für mehrere Geräte parallel."""
    _dispatch_get_state(config, live)


@cli.command("getState")
@click.option(
    "--live",
    is_flag=True,
    help=(
        "Wie get-state --live: pro Update zwei JSON-Zeilen (State + statistics); Ende mit Strg+C."
    ),
)
@pass_config
def getState_cmd(config: dict, live: bool):
    """Alias für get-state."""
    _dispatch_get_state(config, live)


@cli.command()
@pass_config
def state(config: dict):
    """Verbindung herstellen und Zustand ausgeben (für Backend: -l DEBUG)."""
    take = _new_cli_one_shot()

    async def state_callback(device):
        if device.basic_info is None:
            return
        # Bei manchen multifun/energy Geräten bleibt `available` lange False,
        # obwohl bereits verwertbare Telemetrie + basic_info vorliegt.
        # Für One-shot `state` daher bei erstem brauchbaren Update sofort liefern.
        if not await take():
            return
        payload = await _build_state_payload(device, config, live=False)
        json_stdout_only(payload)
        if not _machine_mode(config):
            print_device_details(
                device,
                switches_override=payload.get("switches"),
            )
        device.shutdown_event_loop()

    logger.info("Initialising SonoffSwitch with host %s" % config["host"])
    SonoffSwitch(
        host=config["host"],
        callback_after_update=state_callback,
        logger=logger,
        device_id=config["device_id"],
        api_key=config["api_key"],
        outlet=config["outlet"],
    )


@cli.command()
@pass_config
def on(config: dict):
    """Turn the device on."""
    switch_device(config, config["inching"], "on")


@cli.command()
@pass_config
def off(config: dict):
    """Turn the device off."""
    switch_device(config, config["inching"], "off")


@cli.command()
@click.option(
    "--follow",
    is_flag=True,
    help="Kontinuierlich Updates ausgeben (sonst nur erstes).",
)
@click.option(
    "--json",
    "json_lines",
    is_flag=True,
    help="Pro Update eine JSON-Zeile auf stdout.",
)
@pass_config
def listen(config: dict, follow: bool, json_lines: bool):
    """Zustand ausgeben; mit --follow weiter hören."""
    take = _new_cli_one_shot()

    async def state_callback(self_dev: SonoffSwitch):
        if self_dev.basic_info is None:
            return
        if not follow:
            if not await take():
                return

        self_dev.shared_state["callback_counter"] = (
            self_dev.shared_state.get("callback_counter", 0) + 1
        )
        ctr = self_dev.shared_state["callback_counter"]

        if json_lines or _machine_mode(config):
            json_stdout_only(
                {
                    "ok": True,
                    "n": ctr,
                    "switch": self_dev.params.get("switch"),
                    "basicInfo": self_dev.basic_info,
                }
            )
        else:
            print_device_details(self_dev)

        max_wait = config.get("wait")
        if not follow:
            self_dev.shutdown_event_loop()
        elif max_wait is not None and ctr >= int(max_wait):
            self_dev.shutdown_event_loop()

    logger.info("Initialising SonoffSwitch with host %s" % config["host"])

    shared_state = {"callback_counter": 0}
    SonoffSwitch(
        host=config["host"],
        callback_after_update=state_callback,
        shared_state=shared_state,
        logger=logger,
        device_id=config["device_id"],
        api_key=config["api_key"],
        outlet=config["outlet"],
        emit_every_multifun_telemetry=follow,
    )


def print_device_details(
    device: SonoffSwitch, switches_override: Optional[list] = None
):
    if device.basic_info is None:
        return
    device_id = device.device_id

    logger.info(
        click.style(
            "== Device: %s (%s) ==" % (device_id, device.host), bold=True
        )
    )

    logger.info(
        "State: "
        + click.style(
            "ON" if device.is_on else "OFF",
            fg="green" if device.is_on else "red",
        )
    )

    raw_type = device.client.type
    type_str = (
        raw_type.decode("utf-8", errors="replace")
        if isinstance(raw_type, (bytes, bytearray))
        else str(raw_type)
    )
    logger.info("type: %s", type_str)

    sw_list = (
        switches_override
        if switches_override is not None
        else device.basic_info.get("switches")
    )
    if isinstance(sw_list, list) and sw_list:
        logger.info("Kanäle (switches):")
        for i, ent in enumerate(sw_list):
            if not isinstance(ent, dict):
                logger.info("  [%s] %s", i, ent)
                continue
            ou = ent.get("outlet", i)
            st = ent.get("switch", "?")
            mark = ""
            if device.outlet is not None and int(ou) == int(device.outlet):
                mark = " (gewählter outlet)"
            logger.info('  outlet %s: %s%s', ou, st, mark)


def switch_device(config: dict, inching, new_state: str):
    logger.info("Initialising SonoffSwitch with host %s" % config["host"])
    take = _new_cli_one_shot()

    async def update_callback(device: SonoffSwitch):
        if device.basic_info is None or not device.available:
            return

        if inching is None:
            if not await take():
                return
            already = (
                device.is_on
                and new_state == "on"
                or device.is_off
                and new_state == "off"
            )
            if already:
                json_stdout_ok(True)
                if not _machine_mode(config):
                    print_device_details(device)
                device.shutdown_event_loop()
                return
            if not _machine_mode(config):
                print_device_details(device)
            loop = device.loop
            payload = device.client.get_update_payload(
                device.device_id, {"switch": new_state}
            )
            try:
                resp = await loop.run_in_executor(
                    None, device.client.send_switch, payload
                )
            except Exception as ex:  # pragma: no cover
                json_stdout_ok(False)
                if not _machine_mode(config):
                    logger.exception("switch POST failed")
                device.shutdown_event_loop()
                return
            body = resp.content.decode("utf-8", errors="replace")
            iv = device.client._last_sent_iv or ""
            ok, parsed = parse_zeroconf_http_response(
                body, iv, config.get("api_key") or ""
            )
            json_stdout_ok(ok)
            if not _machine_mode(config) and parsed is not None:
                logger.debug(
                    "%s HTTP %s ok=%s — %s",
                    new_state,
                    resp.status_code,
                    ok,
                    json.dumps(parsed, ensure_ascii=False)[:500],
                )
            device.shutdown_event_loop()
        else:
            logger.info(
                "Inching device activated by switching ON for %ss"
                % inching
            )

    SonoffSwitch(
        host=config["host"],
        callback_after_update=update_callback,
        inching_seconds=int(inching) if inching else None,
        logger=logger,
        device_id=config["device_id"],
        api_key=config["api_key"],
        outlet=config["outlet"],
    )


if __name__ == "__main__":
    # pylint: disable=no-value-for-parameter
    cli()
