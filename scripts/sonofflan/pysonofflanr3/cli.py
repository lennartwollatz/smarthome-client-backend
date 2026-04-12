import asyncio
import json
import logging
import re
import signal
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

# getState-Listener: periodischer HTTP-Abgleich Verbrauch — **statistics** (alle Kanäle), ohne Session.
STATISTICS_LISTENER_INTERVAL_SEC = 10.0

_listener_shutdown_holder: Dict[str, Any] = {"device": None}
_listener_signals_installed = False


def _install_listener_shutdown_signals() -> None:
    global _listener_signals_installed
    if _listener_signals_installed:
        return
    _listener_signals_installed = True

    def _handler(_signum, _frame):
        dev = _listener_shutdown_holder.get("device")
        if dev is not None:
            try:
                dev.shutdown_event_loop()
            except Exception:
                pass
        else:
            sys.exit(130)

    for sig_name in ("SIGINT", "SIGTERM"):
        sig = getattr(signal, sig_name, None)
        if sig is None:
            continue
        try:
            signal.signal(sig, _handler)
        except (ValueError, OSError):
            pass


def _lan_http_direct_enabled(config: dict) -> bool:
    """Mit gesetztem ``--host``: kein mDNS, direkt ``http://host:8081`` (Snapshot/statistics/switch/…)."""
    return bool((config.get("host") or "").strip())


def _config_multichannel(config: dict) -> bool:
    """CLI ``--multi``: Mehrkanal (multifun_switch / DUAL R3) — ``/zeroconf/switches`` erzwingen."""
    return bool(config.get("multi"))

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
    executor_factory=None,
):
    """Nach Verbindung (mDNS oder HTTP direkt bei ``--host``): ein HTTP POST auf /zeroconf/<path_segment>.

    json_stdout_only: nur eine kompakte JSON-Zeile auf stdout (kein print_device_details).
    executor_factory: wenn gesetzt, ``callable(device) -> no-arg callable`` statt ``client_method``.
    """
    ran = {"v": False}

    async def callback(device):
        if ran["v"]:
            return
        if not device.available:
            return
        ran["v"] = True
        try:
            if executor_factory is not None:
                fn = executor_factory(device)
            else:
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
        if _lan_http_direct_enabled(config):
            logger.info(
                "%s: HTTP direkt …/zeroconf/%s (Host %s)",
                title,
                path_segment,
                config["host"],
            )
        else:
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
            lan_http_direct=_lan_http_direct_enabled(config),
            multichannel=_config_multichannel(config),
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
        "Für Strom u. a. werden bei `state` alle Kanäle ausgegeben, sobald `switches` in den Daten liegt. "
        "Zum Schalten die Unterbefehle `on` bzw. `off` nach den Optionen setzen (z. B. `--outlet 0 off`). "
        "Mit ``--multi`` Mehrkanal-Gerät kennzeichnen (siehe dort)."
    ),
)
@click.option(
    "--multi",
    is_flag=True,
    default=False,
    help=(
        "Gerät als Mehrkanal-/multifun_switch behandeln (z. B. SONOFF DUAL R3), "
        "v. a. mit ``--host`` ohne mDNS: immer ``POST …/zeroconf/switches`` und ``switches``-Payload."
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
        "(nur JSON auf stdout bei statistics/switch/switches/snapshot|get-snapshot/getSnapshot: "
        "ok/switch/switches/basicInfo/statistics, ggf. zeroconfSwitches; getState: fortlaufend mDNS+statistics)."
    ),
)
@click.version_option()
def cli(ctx, host, device_id, api_key, inching, wait, outlet, multi, loglevel):
    """Sonoff LAN Mode per CLI.

    Schalten: Unterbefehl ``on`` oder ``off`` (Beispiel:
    ``--host … --device_id … --api_key … --outlet 0 off``).
    """
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
        "multi": multi,
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
    """Gerätezustand: mit ``--host`` mDNS + HTTP-Probe, passende mDNS-Antwort als JSON; sonst wie bisher."""

    async def state_callback(device):
        if getattr(device, "_state_mdns_hybrid", False):
            return
        if getattr(device, "_lan_http_direct", False) and device.basic_info is None and device.available:
            r = await device.loop.run_in_executor(
                None, device.client.send_empty_zeroconf_switch
            )
            inner = parse_zeroconf_http_response(device.api_key, r.content)
            if inner:
                device.merge_basic_info_from_response(inner)
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
        lan_http_direct=_lan_http_direct_enabled(config),
        multichannel=_config_multichannel(config),
        state_mdns_hybrid=_lan_http_direct_enabled(config),
    )


def _run_state_listener(config: dict) -> None:
    """getState: dauerhaft mDNS (entschlüsseltes JSON je Zeile) + alle 10 s statistics (HTTP ohne Session)."""

    shared_state = {"stats_started": False}

    async def state_callback(self):
        _listener_shutdown_holder["device"] = self
        if not shared_state["stats_started"] and getattr(self.client, "url", None):
            shared_state["stats_started"] = True
            self.loop.create_task(
                _statistics_ephemeral_stdout_loop(self, STATISTICS_LISTENER_INTERVAL_SEC)
            )

    logger.info("Initialising SonoffSwitch with host %s" % config["host"])

    _listener_shutdown_holder["device"] = None
    _install_listener_shutdown_signals()
    SonoffDevice.mirror_decrypted_mdns_json_to_stdout = True
    SonoffDevice.invoke_callback_on_multifun_partial = True
    SonoffDevice.allow_listener_parent_without_basic = True
    try:
        SonoffSwitch(
            host=config["host"],
            callback_after_update=state_callback,
            shared_state=shared_state,
            logger=logger,
            device_id=config["device_id"],
            api_key=config["api_key"],
            outlet=config["outlet"],
            lan_http_direct=False,
            multichannel=_config_multichannel(config),
        )
    finally:
        _listener_shutdown_holder["device"] = None
        SonoffDevice.allow_listener_parent_without_basic = False
        SonoffDevice.invoke_callback_on_multifun_partial = False
        SonoffDevice.mirror_decrypted_mdns_json_to_stdout = False


def _run_state_snapshot(config: dict) -> None:
    """Eine JSON-Zeile: Schalter + basicInfo + statistics (+ ggf. zeroconfSwitches), dann Ende."""

    shared_state = {"once_emitted": False}

    async def state_callback(self):
        if getattr(self, "_lan_http_direct", False):
            if shared_state["once_emitted"]:
                return
            shared_state["once_emitted"] = True
            await _emit_get_state_after_http_primer_async(self)
            self.shutdown_event_loop()
            return
        if self.basic_info is None:
            return
        if shared_state["once_emitted"]:
            return
        shared_state["once_emitted"] = True
        await _emit_get_state_json_stdout_async(self)
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
            lan_http_direct=_lan_http_direct_enabled(config),
            multichannel=_config_multichannel(config),
        )
    finally:
        SonoffDevice.invoke_callback_on_multifun_partial = False


GET_STATE_HELP = (
    "Dauerhafter Listener: mDNS (jede entschlüsselte Teilmeldung eine JSON-Zeile auf stdout) und "
    "alle 10 s ``POST /zeroconf/statistics`` (Verbindung nach jeder Antwort geschlossen; alle Kanäle). "
    "Ende mit SIGINT/SIGTERM. Einmaliger kombinierter Abruf: ``snapshot`` / ``get-snapshot`` / ``getSnapshot``. "
    "Mit ``--host`` nur bei Snapshot: kein mDNS, direkt HTTP (Port 8081). Mit ``-l OFF`` nur JSON."
)

SNAPSHOT_HELP = (
    "Eine JSON-Zeile: Schaltzustände + ``basicInfo`` + ``statistics`` (Verbrauch aller Kanäle); "
    "bei ≥2 Kanälen zusätzlich ``zeroconfSwitches``. Mit ``--host``: kein mDNS, direkt HTTP (Port 8081). "
    "Mit ``-l OFF`` nur JSON."
)


@cli.command("get-state", help=GET_STATE_HELP)
@pass_config
def get_state_dash(config: dict):
    _run_state_listener(config)


@cli.command(
    "getState",
    help=GET_STATE_HELP + " Gleiche Funktion wie ``get-state``.",
)
@pass_config
def get_state_camel(config: dict):
    _run_state_listener(config)


@cli.command("get-snapshot", help=SNAPSHOT_HELP)
@pass_config
def get_snapshot_dash(config: dict):
    _run_state_snapshot(config)


@cli.command(
    "getSnapshot",
    help=SNAPSHOT_HELP + " Gleiche Funktion wie ``get-snapshot``.",
)
@pass_config
def get_snapshot_camel(config: dict):
    _run_state_snapshot(config)


@cli.command("snapshot", help=SNAPSHOT_HELP)
@pass_config
def snapshot_cmd(config: dict):
    _run_state_snapshot(config)


@cli.command()
@pass_config
def statistics(config: dict):
    """POST /zeroconf/statistics mit leerem Payload (verschlüsselt wenn nötig).

    Entspricht dem SonoffLAN-Befehl „statistics“ (u. a. für unterstützte POW-/Mess-Geräte).
    """
    _cli_zeroconf_empty_post(
        config,
        "statistics",
        "send_statistics",
        "statistics",
        json_stdout_only=True,
    )


@cli.command("switch")
@click.argument(
    "state",
    required=False,
    type=click.Choice(["on", "off"], case_sensitive=False),
)
@pass_config
def zeroconf_switch(config: dict, state: Optional[str]):
    """Ohne Argument: POST ``/zeroconf/switch`` mit ``data`` ``{}``; mit ``on``/``off``: schalten."""
    if state is None:
        _cli_zeroconf_empty_post(
            config,
            "switch",
            "send_zeroconf_switch_empty_query",
            "switch",
            json_stdout_only=True,
        )
    else:
        st = state.lower()
        _cli_zeroconf_empty_post(
            config,
            "switch %s" % st,
            "send_switch_command",
            "switch",
            json_stdout_only=True,
            executor_factory=lambda d, s=st: (lambda: d.client.send_switch_command(s)),
        )


@cli.command("switches")
@pass_config
def zeroconf_switches(config: dict):
    """POST ``/zeroconf/switch`` mit ``data`` = ``{"switches": []}`` (Mehrkanal-Abfrage)."""
    _cli_zeroconf_empty_post(
        config,
        "switches",
        "send_zeroconf_switches_empty_list_query",
        "switch",
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
            multichannel=_config_multichannel(config),
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


def _is_multi_switch_device(device) -> bool:
    """Mehrkanal per mDNS (DUALR3 / Strip): optional HTTP zeroconf/switches ergänzen."""
    if getattr(device.client, "_force_multichannel_zeroconf", False):
        return True
    switches_arr = (device.basic_info or {}).get("switches")
    if not isinstance(switches_arr, list) or len(switches_arr) < 2:
        return False
    t = device.client.type
    return t in (b"multifun_switch", b"strip")


async def _statistics_ephemeral_stdout_loop(
    device, interval: Optional[float] = None
) -> None:
    """getState-Listener: regelmäßig POST /zeroconf/statistics ohne HTTP-Session."""
    if interval is None:
        interval = STATISTICS_LISTENER_INTERVAL_SEC
    interval = max(0.5, float(interval))
    while True:
        try:
            resp = await device.loop.run_in_executor(
                None, device.client.send_statistics_ephemeral
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


async def _emit_get_state_after_http_primer_async(device) -> None:
    """Ohne mDNS: einmal ``/zeroconf/switch`` (leer), dann wie üblich JSON-Zeile bauen."""
    r0 = await device.loop.run_in_executor(
        None, device.client.send_empty_zeroconf_switch
    )
    inner0 = parse_zeroconf_http_response(device.api_key, r0.content)
    if inner0:
        device.merge_basic_info_from_response(inner0)
    await _emit_get_state_json_stdout_async(device)


async def _emit_get_state_json_stdout_async(device) -> None:
    """getState: eine Zeile inkl. Verbrauch (statistics) und ggf. zeroconfSwitches."""
    payload = _build_get_state_payload(device)
    if _is_multi_switch_device(device):
        try:
            response = await device.loop.run_in_executor(
                None, device.client.send_empty_zeroconf_switches
            )
            payload["zeroconfSwitches"] = _zeroconf_http_aux_block(
                device, response, "getState", ["getState"]
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


def _multifun_outlet_switch_known(device: SonoffSwitch) -> bool:
    """True, wenn der Kanalzustand aus basic_info (mDNS) kommt — nicht nur geraten.

    multifun_switch sendet oft zuerst nur Messwerte ohne ``switches[]``. Dann liefert
    ``is_on``/``is_off`` fälschlich AUS (kein Kanal in basic_info), und ein ``off``-Befehl
    würde sonst sofort beenden ohne HTTP (siehe User-Log).
    """
    if getattr(device.client, "type", None) != b"multifun_switch":
        return True
    bi = device.basic_info or {}
    out = device.outlet if device.outlet is not None else 0
    if isinstance(bi.get("switches"), list):
        sw = _switch_dict_for_outlet(bi["switches"], int(out))
        if sw is not None and sw.get("switch") is not None:
            return True
    sw_top = bi.get("switch")
    if isinstance(sw_top, str) and sw_top in ("on", "off"):
        return True
    return False


def switch_device(config: dict, inching, new_state):
    logger.info("Initialising SonoffSwitch with host %s" % config["host"])

    async def update_callback(device: SonoffSwitch):
        device.client.set_zeroconf_primer_switch_state(new_state)
        if not device.available:
            return
        if getattr(device, "_lan_http_direct", False) and device.basic_info is None:
            r = await device.loop.run_in_executor(
                None, device.client.send_empty_zeroconf_switch
            )
            inner = parse_zeroconf_http_response(device.api_key, r.content)
            if inner:
                device.merge_basic_info_from_response(inner)
        if device.basic_info is not None:

            if device.available:

                if inching is None:
                    print_device_details(device)

                    known = _multifun_outlet_switch_known(device)

                    if new_state == "on":
                        if known and device.is_on:
                            device.shutdown_event_loop()
                        elif not (known and device.is_on):
                            await device.turn_on()
                    elif new_state == "off":
                        if known and device.is_off:
                            device.shutdown_event_loop()
                        elif not (known and device.is_off):
                            await device.turn_off()

                else:
                    logger.info(
                        "Inching device activated by switching ON for %ss"
                        % inching
                    )

        # Primer-POST (z. B. /switches mit Zielzustand) kann schon den Zustand setzen;
        # dann ist turn_* ein No-Op ohne params_updated_event — send_updated_params_loop würde sonst blockieren.
        if (
            getattr(device, "_lan_http_direct", False)
            and getattr(device, "_exit_after_lan_http_switch", False)
            and not device.params_updated_event.is_set()
        ):
            device.shutdown_event_loop()

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
            lan_http_direct=_lan_http_direct_enabled(config),
            exit_after_lan_http_switch=(
                inching is None and _lan_http_direct_enabled(config)
            ),
            multichannel=_config_multichannel(config),
        )
    finally:
        SonoffDevice.invoke_callback_on_multifun_partial = False


if __name__ == "__main__":
    # pylint: disable=no-value-for-parameter
    cli()
