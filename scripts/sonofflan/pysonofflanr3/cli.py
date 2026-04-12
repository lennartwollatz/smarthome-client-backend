import asyncio
import json
import logging
import re
import sys
from typing import Any, Dict, List, Optional

import click
import click_log
from click_log import ClickHandler

from pysonofflanr3 import SonoffSwitch, Discover
from pysonofflanr3.client import (
    format_zeroconf_http_body_as_json,
    parse_zeroconf_http_response,
)
from pysonofflanr3.sonoffdevice import SonoffDevice, _switch_dict_for_outlet

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


def apply_loglevel(loglevel: str) -> None:
    """-l OFF: keine Logs (nur stdout-JSON bei Zeroconf-Befehlen); sonst übliche Stufen."""
    name = (loglevel or "INFO").upper()
    if name == "OFF":
        # Unterdrückt alle Meldungen inkl. CRITICAL für diesen Prozess
        logging.disable(logging.CRITICAL)
        return
    logging.disable(logging.NOTSET)
    level = getattr(logging, name, logging.INFO)
    root = logging.getLogger()
    root.setLevel(level)
    logger.setLevel(level)
    for h in list(root.handlers) + list(logger.handlers):
        try:
            h.setLevel(level)
        except Exception:
            pass


def _http_response_as_dict(api_key: Optional[str], raw: bytes) -> Dict[str, Any]:
    """Gleiche Struktur wie format_zeroconf_http_body_as_json, als dict (entschlüsseltes data)."""
    return json.loads(format_zeroconf_http_body_as_json(api_key, raw, indent=None))


def _stdout_json_line(payload: Dict[str, Any]) -> None:
    """Genau eine JSON-Zeile auf stdout (für Node & Co.)."""
    sys.stdout.write(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str)
        + "\n"
    )
    sys.stdout.flush()


def _cli_zeroconf_empty_post(
    config: dict,
    title: str,
    client_method: str,
    path_segment: str,
    json_stdout_only: bool = False,
):
    """Nach mDNS-Verbindung: genau ein HTTP POST auf /zeroconf/<path_segment> mit leerem Payload.

    json_stdout_only: nur eine kompakte JSON-Zeile auf stdout (kein print_device_details).
    """
    ran = {"v": False}

    async def callback(device):
        if ran["v"]:
            return
        if not device.available:
            return
        ran["v"] = True
        try:
            fn = getattr(device.client, client_method)
            response = await device.loop.run_in_executor(None, fn)
            if not json_stdout_only:
                logger.info(
                    click.style(
                        "%s — HTTP %s" % (title, response.status_code), bold=True
                    )
                )
            inner = parse_zeroconf_http_response(device.api_key, response.content)
            if inner:
                device.merge_basic_info_from_response(inner)

            single = _http_response_as_dict(device.api_key, response.content)
            if json_stdout_only:
                single = dict(single)
                single["ok"] = True
                _stdout_json_line(single)
            else:
                _stdout_json_line(single)

            if not json_stdout_only:
                print_device_details(device)
        except Exception as ex:
            if json_stdout_only:
                _stdout_json_line({"ok": False, "error": str(ex)})
                raise SystemExit(1) from ex
            logger.error("%s: Request fehlgeschlagen: %s", title, ex, exc_info=True)
        finally:
            device.shutdown_event_loop()

    if not json_stdout_only:
        logger.info(
            "%s: mDNS, dann POST …/zeroconf/%s (Host %s)",
            title,
            path_segment,
            config["host"],
        )
    SonoffDevice.invoke_callback_on_multifun_partial = True
    try:
        SonoffSwitch(
            host=config["host"],
            callback_after_update=callback,
            logger=logger,
            device_id=config["device_id"],
            api_key=config["api_key"],
            outlet=config["outlet"],
        )
    finally:
        SonoffDevice.invoke_callback_on_multifun_partial = False


def _cli_statistics_live(config: dict, interval: float) -> None:
    """HTTP /zeroconf/statistics wiederholt; jede Antwort eine JSON-Zeile auf stdout."""
    interval = max(0.5, float(interval))
    ran = {"started": False}

    async def callback(device):
        if not device.available:
            return
        if ran["started"]:
            return
        ran["started"] = True

        async def poll_loop():
            while True:
                try:
                    response = await device.loop.run_in_executor(
                        None, device.client.send_statistics
                    )
                    inner = parse_zeroconf_http_response(
                        device.api_key, response.content
                    )
                    if inner:
                        device.merge_basic_info_from_response(inner)
                    single = dict(
                        _http_response_as_dict(
                            device.api_key, response.content
                        )
                    )
                    single["ok"] = True
                    _stdout_json_line(single)
                except Exception as ex:
                    _stdout_json_line({"ok": False, "error": str(ex)})
                await asyncio.sleep(interval)

        device.loop.create_task(poll_loop())

    SonoffDevice.invoke_callback_on_multifun_partial = True
    try:
        SonoffSwitch(
            host=config["host"],
            callback_after_update=callback,
            logger=logger,
            device_id=config["device_id"],
            api_key=config["api_key"],
            outlet=config["outlet"],
        )
    finally:
        SonoffDevice.invoke_callback_on_multifun_partial = False


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
    help="time to wait for listen.",
)
@click.option(
    "--outlet",
    "outlet",
    envvar="PYSONOFFLAN_OUTLET",
    type=int,
    default=None,
    help=(
        "Kanal-Index für Mehrkanal-Geräte (z. B. SONOFF DUALR3: 0 oder 1). "
        "Steuert den mDNS/HTTP-Kontext sowie die Anzeige „State (selected outlet)“. "
        "Für Strom u. a. werden bei `state` alle Kanäle ausgegeben, sobald `switches` in den Daten liegt."
    ),
)
@click.pass_context
@click.option(
    "-l",
    "--loglevel",
    type=click.Choice(
        ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL", "OFF"],
    ),
    default="INFO",
    help=(
        "OFF = keine Log-Ausgaben "
        "(nur JSON auf stdout bei statistics/switch/switches/getState|get-state: "
        "ok/switch/switches/basicInfo/statistics, ggf. zeroconfSwitches)."
    ),
)
@click.version_option()
def cli(ctx, host, device_id, api_key, inching, wait, outlet, loglevel):
    """A cli tool for controlling Sonoff Smart Switches/Plugs in LAN Mode."""
    apply_loglevel(loglevel.upper() if isinstance(loglevel, str) else loglevel)

    if ctx.invoked_subcommand == "discover":
        return

    if host is None and device_id is None:
        logger.error("No host name or device_id given, see usage below:")
        click.echo(ctx.get_help())
        sys.exit(1)

    ctx.obj = {
        "host": host,
        "device_id": device_id,
        "api_key": api_key,
        "inching": inching,
        "wait": wait,
        "outlet": outlet,
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


@cli.command()
@pass_config
def state(config: dict):
    """Connect to device and print current state."""

    async def state_callback(device):
        if device.basic_info is not None:
            if device.available:
                print_device_details(device)

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


def _run_get_state(config: dict, live: bool = False) -> None:
    """getState: ein kombinierter Snapshot oder Live-Stream.

    Ohne ``live``: eine JSON-Zeile (Schalter + basicInfo + statistics + ggf. zeroconfSwitches), dann Ende.
    Mit ``live``: laufend jedes entschlüsselte mDNS-JSON als Zeile; alle 5 s statistics nur bei ``multifun_switch``.
    """

    shared_state = {"once_emitted": False, "stats_loop_started": False}

    async def state_callback(self):
        if live:
            if (
                not shared_state["stats_loop_started"]
                and self.client.type == b"multifun_switch"
            ):
                shared_state["stats_loop_started"] = True
                self.loop.create_task(_live_statistics_stdout_loop(self, 5.0))
            return
        if self.basic_info is None:
            return
        if shared_state["once_emitted"]:
            return
        shared_state["once_emitted"] = True
        await _emit_get_state_json_stdout_async(self)
        self.shutdown_event_loop()

    logger.info("Initialising SonoffSwitch with host %s" % config["host"])

    if live:
        SonoffDevice.mirror_decrypted_mdns_json_to_stdout = True
    SonoffDevice.invoke_callback_on_multifun_partial = True
    try:
        SonoffSwitch(
            host=config["host"],
            callback_after_update=state_callback,
            shared_state=shared_state,
            logger=logger,
            device_id=config["device_id"],
            api_key=config["api_key"],
            outlet=config["outlet"],
        )
    finally:
        SonoffDevice.invoke_callback_on_multifun_partial = False
        SonoffDevice.mirror_decrypted_mdns_json_to_stdout = False


GET_STATE_HELP = (
    "Eine JSON-Zeile: Schaltzustände + ``basicInfo`` + ``statistics`` (Verbrauch aller Kanäle); "
    "bei ≥2 Kanälen zusätzlich ``zeroconfSwitches`` (HTTP /zeroconf/switches). "
    "Mit ``--live``: fortlaufend jedes mDNS-Teil-JSON auf stdout; alle 5 s statistics nur bei multifun_switch. "
    "Prozess endet nur ohne ``--live``; Live per SIGINT/SIGTERM. Mit ``-l OFF`` nur JSON."
)


@cli.command("get-state", help=GET_STATE_HELP)
@pass_config
@click.option(
    "--live",
    is_flag=True,
    default=False,
    help=(
        "mDNS: jedes entschlüsselte JSON als Zeile auf stdout; alle 5 s statistics nur bei multifun_switch. "
        "Ende mit SIGINT/SIGTERM."
    ),
)
def get_state_dash(config: dict, live: bool):
    _run_get_state(config, live=live)


@cli.command(
    "getState",
    help=GET_STATE_HELP + " Gleiche Funktion wie ``get-state``.",
)
@pass_config
@click.option(
    "--live",
    is_flag=True,
    default=False,
    help=(
        "mDNS: jedes entschlüsselte JSON als Zeile auf stdout; alle 5 s statistics nur bei multifun_switch. "
        "Ende mit SIGINT/SIGTERM."
    ),
)
def get_state_camel(config: dict, live: bool):
    _run_get_state(config, live=live)


@cli.command()
@pass_config
@click.option(
    "--interval",
    type=float,
    default=2.0,
    show_default=True,
    help="Sekunden zwischen HTTP-Abfragen, nur mit --live.",
)
@click.option(
    "--live",
    is_flag=True,
    default=False,
    help=(
        "Fortlaufend POST /zeroconf/statistics; jede Antwort eine JSON-Zeile auf stdout "
        "(Prozess bis SIGINT/SIGTERM). Abstand: --interval."
    ),
)
def statistics(config: dict, live: bool, interval: float):
    """POST /zeroconf/statistics mit leerem Payload (verschlüsselt wenn nötig).

    Entspricht dem SonoffLAN-Befehl „statistics“ (u. a. für unterstützte POW-/Mess-Geräte).
    """
    if live:
        _cli_statistics_live(config, interval)
        return
    _cli_zeroconf_empty_post(
        config,
        "statistics",
        "send_statistics",
        "statistics",
        json_stdout_only=True,
    )


@cli.command("switch")
@pass_config
def zeroconf_switch(config: dict):
    """POST /zeroconf/switch mit leerem Payload — Ein-Kanal-Geräte (z. B. Plug)."""
    _cli_zeroconf_empty_post(
        config,
        "switch",
        "send_empty_zeroconf_switch",
        "switch",
        json_stdout_only=True,
    )


@cli.command("switches")
@pass_config
def zeroconf_switches(config: dict):
    """POST /zeroconf/switches mit leerem Payload — Mehrkanal (z. B. DUALR3, Strip)."""
    _cli_zeroconf_empty_post(
        config,
        "switches",
        "send_empty_zeroconf_switches",
        "switches",
        json_stdout_only=True,
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
@pass_config
@click.option(
    "--follow",
    is_flag=True,
    help=(
        "Weiter alle Updates mit menschenlesbarer Protokollierung; "
        "ohne diese Option: genau eine JSON-Zeile auf stdout (erste ausgewertete Antwort) und Exit."
    ),
)
def listen(config: dict, follow: bool):
    """Standard: erste Antwort als zusammengeführtes basic_info (JSON) auf stdout, dann Programmende.

    Mit --follow Verhalten wie zuvor (endlos, bis SIGINT); optional --wait N beendet nach N Updates.
    """

    shared_state = {"callback_counter": 0, "once_emitted": False}

    async def state_callback(self):
        if self.basic_info is None:
            return

        if not follow:
            if shared_state["once_emitted"]:
                return
            shared_state["once_emitted"] = True
            _emit_basic_info_json_stdout(self)
            self.shutdown_event_loop()
            return

        self.shared_state["callback_counter"] += 1
        print_device_details(self)
        if config["wait"] is not None:
            if self.shared_state["callback_counter"] >= int(config["wait"]):
                self.shutdown_event_loop()

    logger.info("Initialising SonoffSwitch with host %s" % config["host"])

    SonoffDevice.invoke_callback_on_multifun_partial = True
    try:
        SonoffSwitch(
            host=config["host"],
            callback_after_update=state_callback,
            shared_state=shared_state,
            logger=logger,
            device_id=config["device_id"],
            api_key=config["api_key"],
            outlet=config["outlet"],
        )
    finally:
        SonoffDevice.invoke_callback_on_multifun_partial = False


def _emit_basic_info_json_stdout(device) -> None:
    """Eine kompakte JSON-Zeile auf stdout (für Pipes); nicht serialisierbare Werte via str()."""
    payload = dict(device.basic_info or {})
    sys.stdout.write(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str)
        + "\n"
    )
    sys.stdout.flush()


def _build_get_state_payload(device) -> Dict[str, Any]:
    """Shape wie Node (SonoffSwitch): ok, switch, switches, basicInfo."""
    info = dict(device.basic_info or {})
    switches_arr = info.get("switches")
    outlet = device.outlet
    if outlet is None:
        outlet = 0

    root_switch_val = None
    top_switches = None

    if isinstance(switches_arr, list) and switches_arr:
        sw_sel = _switch_dict_for_outlet(switches_arr, int(outlet))
        if sw_sel is not None:
            root_switch_val = sw_sel.get("switch")
        if root_switch_val is None:
            first = switches_arr[0]
            if isinstance(first, dict):
                root_switch_val = first.get("switch")
        if len(switches_arr) > 1:
            top_switches = [
                dict(x) if isinstance(x, dict) else x for x in switches_arr
            ]
    else:
        root_switch_val = info.get("switch")

    if root_switch_val is None:
        root_switch_val = info.get("switch")

    return {
        "ok": True,
        "switch": root_switch_val,
        "switches": top_switches,
        "basicInfo": info,
    }


def _zeroconf_http_aux_block(
    device,
    response,
    endpoint: str,
    tried: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """HTTP-/zeroconf-Antwort für JSON (statistics, switches, …)."""
    tl = list(tried) if tried is not None else [endpoint]
    code = int(getattr(response, "status_code", 0) or 0)
    try:
        body = _http_response_as_dict(device.api_key, response.content)
    except Exception as ex:
        return {
            "ok": False,
            "httpStatus": code,
            "data": {},
            "endpoint": endpoint,
            "tried": tl,
            "error": str(ex),
        }
    err = body.get("error", -1)
    data = body.get("data")
    if data is None:
        data = {}
    elif not isinstance(data, dict):
        data = {"_value": data}
    ok = code == 200 and err == 0
    return {
        "ok": ok,
        "httpStatus": code,
        "data": data,
        "endpoint": endpoint,
        "tried": tl,
    }


def _zeroconf_switches_block_with_mdns_fallback(device, response) -> Dict[str, Any]:
    """HTTP /zeroconf/switches + fehlende Schalt-Daten aus mDNS-merge (basic_info).

    Viele Firmware-Varianten antworten nur mit ACK (error=0, ggf. encrypt=true) **ohne**
    entschlüsselbares ``data``/``iv`` — der eigentliche Zustand kommt parallel per
    **mDNS** (eWeLink-Service, verschlüsselte ``data1``/…-Properties), nicht per TCP-Multicast.
    """
    block = _zeroconf_http_aux_block(device, response, "getState", ["getState"])
    if block.get("ok") is not True:
        return block
    inner = block.get("data")
    if not isinstance(inner, dict):
        inner = {}
    bi = dict(device.basic_info or {})
    patched = False
    if not inner.get("switches") and isinstance(bi.get("switches"), list):
        inner["switches"] = list(bi["switches"])
        patched = True
    for k in ("configure", "pulses", "workMode"):
        if k in bi and k not in inner:
            inner[k] = bi[k]
            patched = True
    for k, v in bi.items():
        if (k.startswith("swMode_") or k.startswith("swReverse_")) and k not in inner:
            inner[k] = v
            patched = True
    if patched:
        block = {
            **block,
            "data": inner,
            "switchesDetailSource": "mDNS",
        }
    return block


def _is_multi_switch_device(device) -> bool:
    """Mehrkanal per mDNS (DUALR3 / Strip): optional HTTP zeroconf/switches ergänzen."""
    switches_arr = (device.basic_info or {}).get("switches")
    if not isinstance(switches_arr, list) or len(switches_arr) < 2:
        return False
    t = device.client.type
    return t in (b"multifun_switch", b"strip")


async def _live_statistics_stdout_loop(device, interval: float = 5.0) -> None:
    """getState --live: regelmäßig POST /zeroconf/statistics (nur multifun_switch)."""
    interval = max(0.5, float(interval))
    while True:
        try:
            resp = await device.loop.run_in_executor(
                None, device.client.send_statistics
            )
            _stdout_json_line(
                _zeroconf_http_aux_block(
                    device, resp, "statistics", ["statistics"]
                )
            )
        except Exception as ex:
            _stdout_json_line(
                {
                    "ok": False,
                    "httpStatus": 0,
                    "data": {},
                    "endpoint": "statistics",
                    "tried": ["statistics"],
                    "error": str(ex),
                }
            )
        await asyncio.sleep(interval)


async def _emit_get_state_json_stdout_async(device) -> None:
    """getState: eine Zeile inkl. Verbrauch (statistics) und ggf. zeroconfSwitches."""
    payload = _build_get_state_payload(device)
    if _is_multi_switch_device(device):
        try:
            response = await device.loop.run_in_executor(
                None, device.client.send_empty_zeroconf_switches
            )
            payload["zeroconfSwitches"] = _zeroconf_switches_block_with_mdns_fallback(
                device, response
            )
        except Exception as ex:
            payload["zeroconfSwitches"] = {
                "ok": False,
                "httpStatus": 0,
                "data": {},
                "endpoint": "getState",
                "tried": ["getState"],
                "error": str(ex),
            }
    try:
        stats_resp = await device.loop.run_in_executor(
            None, device.client.send_statistics
        )
        payload["statistics"] = _zeroconf_http_aux_block(
            device, stats_resp, "statistics", ["statistics"]
        )
    except Exception as ex:
        payload["statistics"] = {
            "ok": False,
            "httpStatus": 0,
            "data": {},
            "endpoint": "statistics",
            "tried": ["statistics"],
            "error": str(ex),
        }
    sys.stdout.write(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str)
        + "\n"
    )
    sys.stdout.flush()


def print_device_details(device):
    if device.basic_info is not None:
        device_id = device.device_id
        out_idx = device.client.outlet
        if out_idx is None:
            out_idx = 0

        logger.info(
            click.style(
                "== Device: %s (%s) ==" % (device_id, device.host), bold=True
            )
        )

        switches = device.basic_info.get("switches")
        if isinstance(switches, list) and len(switches) > 1:
            logger.info(
                "Outlet (CLI --outlet / Kanal): %s (0-basiert)", out_idx
            )

        logger.info(
            "State (selected outlet): "
            + click.style(
                "ON" if device.is_on else "OFF",
                fg="green" if device.is_on else "red",
            )
        )

        _print_root_aggregate_power(device.basic_info)
        _print_flat_per_outlet_suffixed(device.basic_info)
        _print_all_switch_entries(device.basic_info)


def _print_root_aggregate_power(basic_info: dict):
    """Einige Firmware-Varianten legen Leistung nur am JSON-Root, nicht pro switches[]."""
    keys = (
        "power",
        "actPow",
        "reactPow",
        "apparentPow",
        "voltage",
        "current",
        "dayKwh",
        "monthKwh",
        "yearKwh",
    )
    found = {k: basic_info[k] for k in keys if k in basic_info and basic_info[k] is not None}
    if found:
        logger.info(
            click.style("Aggregat / Top-Level (sofern geliefert):", bold=True)
            + " "
            + " ".join("%s=%s" % (k, v) for k, v in found.items())
        )


def _print_flat_per_outlet_suffixed(basic_info: dict):
    """SonoffLAN / UIID 126: actPow_00, current_01, voltage_00, … statt nur in switches[]."""
    skip = frozenset({"switches", "deviceid", "configure", "pulses", "rssi"})
    by_suffix = {}
    for k, v in basic_info.items():
        if k in skip or v is None:
            continue
        m = re.match(r"^(.+)_(\d+)$", k)
        if not m:
            continue
        suf = m.group(2)
        by_suffix.setdefault(suf, []).append((k, v))
    if by_suffix:
        logger.info(
            click.style(
                "Pro Kanal (flache Keys *_00, *_01, … wie bei SonoffLAN DualR3):",
                bold=True,
            )
        )
        for suf in sorted(by_suffix.keys(), key=lambda x: int(x) if x.isdigit() else x):
            pairs = " ".join(
                "%s=%s" % (kk, vv) for kk, vv in sorted(by_suffix[suf])
            )
            logger.info("  Kanal-Suffix _%s: %s", suf, pairs)


def _format_switch_value(val):
    if isinstance(val, (dict, list)):
        return json.dumps(val, ensure_ascii=False, separators=(",", ":"))
    return val


def _print_all_switch_entries(basic_info: dict):
    """Jeden Eintrag in switches[] mit allen Keys/Values (alle Kanäle)."""
    switches = basic_info.get("switches")
    if not isinstance(switches, list) or not switches:
        return

    logger.info(
        click.style("Alle switches[]-Einträge (vollständig):", bold=True)
    )
    for idx, sw in enumerate(switches):
        if not isinstance(sw, dict):
            logger.info("  [%s] %r", idx, sw)
            continue
        outlet = sw.get("outlet", idx)
        pairs = []
        for k in sorted(sw.keys()):
            pairs.append("%s=%s" % (k, _format_switch_value(sw[k])))
        logger.info(
            "  [%s] outlet=%s %s",
            idx,
            outlet,
            " ".join(pairs),
        )


def switch_device(config: dict, inching, new_state):
    logger.info("Initialising SonoffSwitch with host %s" % config["host"])

    async def update_callback(device: SonoffSwitch):
        if device.basic_info is not None:

            if device.available:

                if inching is None:
                    print_device_details(device)

                    if device.is_on:
                        if new_state == "on":
                            device.shutdown_event_loop()
                        else:
                            await device.turn_off()

                    elif device.is_off:
                        if new_state == "off":
                            device.shutdown_event_loop()
                        else:
                            await device.turn_on()

                else:
                    logger.info(
                        "Inching device activated by switching ON for %ss"
                        % inching
                    )

    # DUALR3/multifun_switch liefert anfangs haeufig Teil-Updates ohne
    # "switch". Dann wuerde der Callback sonst ggf. nie laufen und on/off
    # nicht ausgelöst werden.
    SonoffDevice.invoke_callback_on_multifun_partial = True
    try:
        SonoffSwitch(
            host=config["host"],
            callback_after_update=update_callback,
            inching_seconds=int(inching) if inching else None,
            logger=logger,
            device_id=config["device_id"],
            api_key=config["api_key"],
            outlet=config["outlet"],
        )
    finally:
        SonoffDevice.invoke_callback_on_multifun_partial = False


if __name__ == "__main__":
    # pylint: disable=no-value-for-parameter
    cli()
