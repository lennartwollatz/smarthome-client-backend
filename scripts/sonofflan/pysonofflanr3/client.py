import json
import logging
import time
from typing import Dict, Union, Callable, Awaitable, Optional, Any
import asyncio
import traceback
import collections
import requests
from zeroconf import ServiceBrowser, Zeroconf
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from pysonofflanr3 import sonoffcrypto
from pysonofflanr3 import utils
import socket


def parse_zeroconf_http_response(
    api_key: Optional[str], raw: bytes
) -> Optional[Dict[str, Any]]:
    """Inneres JSON aus POST-Antwort /zeroconf/* (Klartext oder encrypt+data+iv)."""
    try:
        body = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None
    if body.get("error", -1) != 0:
        return None
    data = body.get("data")
    if data is None:
        return None
    if bool(body.get("encrypt")) and isinstance(data, str):
        if not api_key:
            return None
        iv = body.get("iv")
        if iv is None:
            return None
        plaintext = sonoffcrypto.decrypt(data, iv, api_key)
        inner = json.loads(plaintext.decode("utf-8"))
        return inner if isinstance(inner, dict) else None
    if isinstance(data, dict):
        return data
    if isinstance(data, str):
        try:
            inner = json.loads(data)
            return inner if isinstance(inner, dict) else None
        except ValueError:
            return None
    return None


def _json_dumps_for_display(obj: Any, indent: Optional[int]) -> str:
    kw = {"ensure_ascii": False}
    if indent is not None:
        kw["indent"] = indent
    else:
        kw["separators"] = (",", ":")
    return json.dumps(obj, **kw)


def format_zeroconf_http_body_as_json(
    api_key: Optional[str],
    raw: bytes,
    indent: Optional[int] = 2,
) -> str:
    """HTTP-/zeroconf-Antwort als JSON-String; bei encrypt+data ist `data` das entschlüsselte Objekt (dict/list), nicht Base64.

    Fehlerantworten (error != 0) unverändert; Entschlüsselung nur bei error == 0.
    Mit indent=None eine kompakte Zeile (z. B. für stdout / Pipe).
    """
    try:
        body = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as ex:
        return _json_dumps_for_display(
            {
                "_parse_error": str(ex),
                "_raw": raw.decode("utf-8", "replace")[:2000],
            },
            indent,
        )

    out: Dict[str, Any] = {}
    for k in ("sequence", "seq", "error", "encrypt", "iv"):
        if k in body:
            out[k] = body[k]

    err = body.get("error", -1)
    data = body.get("data")

    if err != 0:
        if data is not None:
            out["data"] = data
        return _json_dumps_for_display(out, indent)

    if data is None:
        return _json_dumps_for_display(out, indent)

    if bool(body.get("encrypt")) and isinstance(data, str):
        iv = body.get("iv")
        if not api_key or iv is None:
            out["data_ciphertext"] = data
            out["_note"] = "api_key oder iv fehlt, Entschlüsselung übersprungen"
        else:
            try:
                plaintext = sonoffcrypto.decrypt(data, iv, api_key)
                inner: Any = json.loads(plaintext.decode("utf-8"))
                out["data"] = inner
            except Exception as ex:
                out["data_ciphertext"] = data
                out["_decrypt_error"] = str(ex)
    elif isinstance(data, dict):
        out["data"] = data
    elif isinstance(data, str):
        try:
            out["data"] = json.loads(data)
        except ValueError:
            out["data"] = data
    else:
        out["data"] = data

    return _json_dumps_for_display(out, indent)


class SonoffLANModeClient:
    """
    Implementation of the Sonoff LAN Mode Protocol R3

    Uses protocol as was documented by Itead

    This document has since been unpublished
    """

    """
    Initialise class with connection parameters

    :param str host: host name (is ip address)
    :param device_id: the device name in the mDS servie name
    :return:
    """

    DEFAULT_TIMEOUT = 5
    DEFAULT_PING_INTERVAL = 5
    SERVICE_TYPE = "_ewelink._tcp.local."

    # only a single zeroconf instance for all instances of this class
    zeroconf = Zeroconf()

    def __init__(
        self,
        host: str,
        event_handler: Callable[[str], Awaitable[None]],
        ping_interval: int = DEFAULT_PING_INTERVAL,
        timeout: int = DEFAULT_TIMEOUT,
        logger: logging.Logger = None,
        loop=None,
        device_id: str = "",
        api_key: str = "",
        outlet: int = None,
        force_multichannel_zeroconf: bool = False,
    ):

        self.host = host
        self.device_id = device_id
        self.api_key = api_key
        self.outlet = outlet
        self.logger = logger
        self.event_handler = event_handler
        self.connected_event = asyncio.Event()
        self.disconnected_event = asyncio.Event()
        self.service_browser = None
        self.loop = loop
        self.http_session = None
        self.my_service_name = None
        self.last_request = None
        self.encrypted = False
        self.type = None
        self.properties: Dict = {}
        self._info_cache = None
        self._last_params = {"switch": "off"}
        self._times_added = 0
        # Ohne mDNS (nur --host): type bleibt None — Hint aus basic_info oder Fehlerantwort.
        self._prefer_switches_zeroconf = False
        # CLI ``--multi``: immer Mehrkanal-Endpoint (DUAL R3 / multifun_switch ohne mDNS-Typ).
        self._force_multichannel_zeroconf = bool(force_multichannel_zeroconf)
        # Erster POST ``/zeroconf/switches`` (Primer): ``on``/``off`` aus CLI (``switch_device``).
        self._primer_switch_state: Optional[str] = None
        # SonoffDevice übergibt timeout; ohne Nutzung blockiert requests bei ausbleibender Antwort endlos.
        self.request_timeout = float(timeout) if timeout is not None else float(
            SonoffLANModeClient.DEFAULT_TIMEOUT
        )

    @staticmethod
    def _format_received_payload(payload: Any) -> str:
        if isinstance(payload, (bytes, bytearray)):
            try:
                txt = payload.decode("utf-8")
                try:
                    return _json_dumps_for_display(json.loads(txt), indent=None)
                except ValueError:
                    return txt
            except UnicodeDecodeError:
                return repr(payload)
        return str(payload)

    def connect_direct_http(self, port: int = 8081) -> None:
        """Ohne mDNS: Session und ``http://<host>:<port>`` sofort nutzen (üblich 8081).

        ``encrypted`` folgt dem Vorhandensein von ``api_key``. ``type`` bleibt unbekannt
        (``None``) — Mehrkanal-Geräte ggf. weiter per mDNS/``listen()`` anbinden.
        """
        self.service_browser = None
        self.my_service_name = None
        if not (self.host or "").strip():
            raise ValueError("connect_direct_http requires host")
        self.set_url(self.host.strip(), str(int(port)))
        self.create_http_session()
        self.set_retries(0)
        self.encrypted = bool(self.api_key and str(self.api_key).strip())
        self.type = None
        self._prefer_switches_zeroconf = False
        did = (self.device_id or "").strip()
        self.properties = {b"id": did.encode("utf-8")} if did else {}
        self.connected_event.set()

    def set_zeroconf_primer_switch_state(self, state: Optional[str]) -> None:
        """Für ``send_empty_zeroconf_switches``: Ziel-``switch`` (``on``/``off``) vor dem Schalt-POST."""
        st = (state or "").strip().lower()
        self._primer_switch_state = st if st in ("on", "off") else None

    def use_zeroconf_switches_endpoint(self) -> bool:
        """True: POST …/zeroconf/switches (Mehrkanal); False: …/zeroconf/switch (Ein-Kanal)."""
        if self._force_multichannel_zeroconf:
            return True
        t = self.type
        if t in (b"strip", b"multifun_switch"):
            return True
        return bool(self._prefer_switches_zeroconf)

    def listen(self):
        """
        Setup a mDNS listener
        """

        # listen for any added SOnOff
        self.service_browser = ServiceBrowser(
            SonoffLANModeClient.zeroconf,
            SonoffLANModeClient.SERVICE_TYPE,
            listener=self,
        )

    def close_connection(self):

        self.logger.debug("enter close_connection()")
        self.service_browser = None
        self.disconnected_event.set()
        self.my_service_name = None

    def remove_service(self, zeroconf, type, name):

        if self.my_service_name == name:
            self._info_cache = None
            self.logger.debug("Service %s flagged for removal" % name)
            self.loop.run_in_executor(None, self.retry_connection)

    def add_service(self, zeroconf, type, name):

        if self.my_service_name is not None:

            if self.my_service_name == name:
                self._times_added += 1
                self.logger.info(
                    "Service %s added again (%s times)"
                    % (name, self._times_added)
                )
                self.my_service_name = None
                asyncio.run_coroutine_threadsafe(
                    self.event_handler({}), self.loop
                )

        if self.my_service_name is None:

            info = zeroconf.get_service_info(type, name)
            if info is None:
                return
            found_ip = utils.service_info_ipv4_str(info)
            if found_ip is None:
                return

            if self.device_id is not None:

                if (
                    name
                    == "eWeLink_"
                    + self.device_id
                    + "."
                    + SonoffLANModeClient.SERVICE_TYPE
                ):
                    self.my_service_name = name

            elif self.host is not None:

                try:

                    if socket.gethostbyname(self.host) == found_ip:
                        self.my_service_name = name

                except TypeError:

                    if self.host == found_ip:
                        self.my_service_name = name

            if self.my_service_name is not None:

                self.logger.info(
                    "Service type %s of name %s added", type, name
                )

                self.create_http_session()
                self.set_retries(0)

                # process the initial message
                self.update_service(zeroconf, type, name)

    def update_service(self, zeroconf, type, name):

        data = None

        # This is needed for zeroconf 0.24.1
        # onwards as updates come to the parent node
        if self.my_service_name != name:
            return

        info = zeroconf.get_service_info(type, name)
        if info is None:
            return
        found_ip = utils.service_info_ipv4_str(info)
        if found_ip is None:
            return
        self.set_url(found_ip, str(info.port))

        # Useful optimsation for 0.24.1 onwards (fixed in 0.24.5 though)
        # as multiple updates that are the same are received
        if info.properties == self._info_cache:
            self.logger.info("same update received for device: %s", name)
            return
        else:
            self._info_cache = info.properties

        try:

            self.logger.debug("properties: %s", info.properties)

            self.type = info.properties.get(b"type")
            self.logger.debug("type: %s", self.type)

            data1 = info.properties.get(b"data1")
            data2 = info.properties.get(b"data2")

            if data2 is not None:
                data1 += data2
                data3 = info.properties.get(b"data3")

                if data3 is not None:
                    data1 += data3
                    data4 = info.properties.get(b"data4")

                    if data4 is not None:
                        data1 += data4

            if info.properties.get(b"encrypt"):

                if self.api_key == "" or self.api_key is None:
                    self.logger.error(
                        "Missing api_key for encrypted device: %s", name
                    )
                    data = None

                else:
                    self.encrypted = True
                    # decrypt the message
                    iv = info.properties.get(b"iv")
                    data = sonoffcrypto.decrypt(data1, iv, self.api_key)
                    self.logger.info(
                        "decrypted data received: %s",
                        self._format_received_payload(data),
                    )

            else:
                self.encrypted = False
                data = data1

            self.properties = info.properties

        except ValueError as ex:
            self.logger.error(
                "Error updating service for device %s: %s"
                " Probably wrong API key.",
                self.device_id,
                format(ex),
            )

        except Exception as ex:  # pragma: no cover
            self.logger.error(
                "Error updating service for device %s: %s, %s",
                self.device_id,
                format(ex),
                traceback.format_exc(),
            )

        finally:
            # process the events on an event loop
            # this method is on a background thread called from zeroconf
            asyncio.run_coroutine_threadsafe(
                self.event_handler(data), self.loop
            )

    def retry_connection(self):

        while True:
            try:
                self.logger.debug(
                    "Sending retry message for %s" % self.device_id
                )

                # in retry connection, we automatically retry 3 times
                self.set_retries(3)
                self.send_signal_strength()
                self.logger.info(
                    "Service %s flagged for removal, but is still active!"
                    % self.device_id
                )
                break

            except OSError as ex:
                self.logger.debug(
                    "Connection issue for device %s: %s",
                    self.device_id,
                    format(ex),
                )
                self.logger.info("Service %s removed" % self.device_id)
                self.close_connection()
                break

            except Exception as ex:  # pragma: no cover
                self.logger.error(
                    "Retry_connection() Unexpected error for device %s: %s %s",
                    self.device_id,
                    format(ex),
                    traceback.format_exc(),
                )
                break

            finally:
                # set retires back to 0
                self.set_retries(0)

    def send_switch(self, request: Union[str, Dict]):
        path = (
            "/zeroconf/switches"
            if self.use_zeroconf_switches_endpoint()
            else "/zeroconf/switch"
        )
        response = self.send(request, self.url + path)

        try:
            response_json = json.loads(response.content.decode("utf-8"))

            error = response_json["error"]

            if error != 0:
                self.logger.warning(
                    "error received: %s, %s", self.device_id, response.content
                )
                # no need to process error, retry will resend message

            else:
                self.logger.debug("message sent to switch successfully")
                # nothing to do, update is processed via the mDNS update

            return response

        except Exception as ex:  # pragma: no cover
            self.logger.error(
                "error %s processing response: %s, %s",
                format(ex),
                response,
                response.content,
            )
        return response

    def send_switch_command(self, state: str):
        """Schalten (``on``/``off``) über ``/zeroconf/switch`` bzw. ``/zeroconf/switches``."""
        st = (state or "").strip().lower()
        if st not in ("on", "off"):
            raise ValueError("state must be 'on' or 'off', got %r" % (state,))
        return self.send_switch(
            self.get_update_payload(self.device_id, {"switch": st})
        )

    def send_signal_strength(self):

        response = self.send(
            self.get_update_payload(self.device_id, {}),
            self.url + "/zeroconf/signal_strength",
        )

        if response.status_code == 500:
            self.logger.error("500 received")
            raise OSError

        else:
            return response

    def send_statistics(self):
        """POST /zeroconf/statistics — wie SonoffLAN (u. a. einige POW-/Mess-Geräte, z. B. UIID 126)."""
        return self.send(
            self.get_update_payload(self.device_id, {}),
            self.url + "/zeroconf/statistics",
        )

    def send_zeroconf_switch_empty_query(self):
        """POST ``/zeroconf/switch`` mit leerem Klartext-``data`` ``{}`` (CLI-Subbefehl ``switch`` ohne Argument)."""
        return self.send(
            self.get_update_payload(self.device_id, {}),
            self.url + "/zeroconf/switch",
        )

    def send_empty_zeroconf_switch(self):
        """Zustands-Abfrage: leerer Payload auf ``/zeroconf/switch`` oder ``/switches`` (Mehrkanal)."""
        if self.use_zeroconf_switches_endpoint():
            return self.send_empty_zeroconf_switches()
        r = self.send(
            self.get_update_payload(self.device_id, {}),
            self.url + "/zeroconf/switch",
        )
        if self.type is None and not self._prefer_switches_zeroconf:
            try:
                body = json.loads(r.content.decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                return r
            if body.get("error", 0) != 0:
                self._prefer_switches_zeroconf = True
                return self.send_empty_zeroconf_switches()
        return r

    def send_empty_zeroconf_switches(self):
        """POST /zeroconf/switches — Mehrkanal (DUALR3): inneres JSON mit ``switches[]``.

        Klartext (bzw. verschlüsselter Inhalt von ``data``): ``{"switches":[{"outlet":n,"switch":"on|off"}]}``.
        ``switch`` kommt aus :meth:`set_zeroconf_primer_switch_state`, sonst ``off``.
        """
        outlet = 0 if self.outlet is None else int(self.outlet)
        hint = self._primer_switch_state
        if hint not in ("on", "off"):
            hint = "off"
        inner = {"switches": [{"outlet": outlet, "switch": hint}]}
        self.logger.debug("send_empty_zeroconf_switches inner=%s", inner)
        return self.send(
            self.get_update_payload(self.device_id, inner),
            self.url + "/zeroconf/switches",
        )

    def send_zeroconf_switches_empty_list_query(self):
        """POST ``/zeroconf/switch`` mit Klartext-``data`` = ``{"switches": []}`` (CLI-Subbefehl ``switches``)."""
        inner = {"switches": []}
        self.logger.debug(
            "send_zeroconf_switches_empty_list_query inner=%s", inner
        )
        return self.send(
            self.get_update_payload(self.device_id, inner),
            self.url + "/zeroconf/switch",
        )

    def send_state_probe_switches_empty(self):
        """POST ``/zeroconf/switches`` — CLI ``state`` (Hybrid): ``{"switches":[{"outlet":n,"switch":"on"}]}``."""
        outlet = 0 if self.outlet is None else int(self.outlet)
        inner = {"switches": [{"outlet": outlet, "switch": "on"}]}
        self.logger.debug("send_state_probe_switches_empty inner=%s", inner)
        return self.send(
            self.get_update_payload(self.device_id, inner),
            self.url + "/zeroconf/switches",
        )

    def send(self, request: Union[str, Dict], url):
        """
        Send message to an already-connected Sonoff LAN Mode Device
        and return the response.
        :param request: command to send to the device (can be dict or json)
        :return:
        """

        data = json.dumps(request, separators=(",", ":"))
        self.logger.debug("Sending http message to %s: %s", url, data)
        response = self.http_session.post(
            url, data=data, timeout=self.request_timeout
        )
        try:
            body = response.content
            self.logger.debug(
                "response received: %s %s", response, body
            )
        finally:
            # TCP nicht offen halten (Keep-Alive); nach Auswertung sofort freigeben.
            try:
                response.close()
            except Exception:
                pass

        return response

    @staticmethod
    def _ephemeral_post_headers():
        return collections.OrderedDict(
            (
                ("Content-Type", "application/json;charset=UTF-8"),
                ("Connection", "close"),
                ("Accept", "application/json"),
                ("Accept-Language", "en-gb"),
            )
        )

    def send_statistics_ephemeral(self):
        """POST /zeroconf/statistics ohne ``http_session`` (TCP nach Antwort schließen)."""
        url = self.url + "/zeroconf/statistics"
        payload = self.get_update_payload(self.device_id, {})
        data = json.dumps(payload, separators=(",", ":"))
        resp = requests.post(
            url,
            data=data,
            headers=self._ephemeral_post_headers(),
            timeout=self.request_timeout,
        )
        try:
            _ = resp.content
        finally:
            resp.close()
        return resp

    def get_update_payload(self, device_id: str, params: dict) -> Dict:

        self._last_params = params

        use_multi_shape = (
            params not in ({}, None)
            and params != {"data": {}}
            and isinstance(params, dict)
            and "switch" in params
            and "switches" not in params
            and self.use_zeroconf_switches_endpoint()
        )
        if use_multi_shape:
            if self.outlet is None:
                self.outlet = 0

            ou = int(self.outlet)
            st = params["switch"]
            params = {"switches": [{"outlet": ou, "switch": st}]}

        payload = {
            "sequence": str(
                int(time.time() * 1000)
            ),  # otherwise buffer overflow type issue caused in the device
            "deviceid": device_id,
        }

        if self.encrypted:

            self.logger.debug("params: %s", params)

            sonoffcrypto.format_encryption_msg(payload, self.api_key, params)
            self.logger.debug("encrypted: %s", payload)

        else:
            payload["encrypt"] = False
            payload["data"] = params
            self.logger.debug("message to send (plaintext): %s", payload)

        return payload

    def set_url(self, ip, port):

        socket_text = ip + ":" + port
        self.url = "http://" + socket_text
        self.logger.debug("service is at %s", self.url)

    def create_http_session(self):

        # Session bleibt; pro Request ``Connection: close`` + :meth:`send` schließt die Response.
        self.http_session = requests.Session()

        # add the http headers
        # note the commented out ones are copies from the sniffed ones
        headers = collections.OrderedDict(
            {
                "Content-Type": "application/json;charset=UTF-8",
                "Connection": "close",
                "Accept": "application/json",
                "Accept-Language": "en-gb",
                # "Content-Length": "0",
                # "Accept-Encoding": "gzip, deflate",
                # "Cache-Control": "no-store",
            }
        )

        # needed to keep headers in same order
        # instead of self.http_session.headers.update(headers)
        self.http_session.headers = headers

    def set_retries(self, retry_count):

        # no retries at moment, control in sonoffdevice
        retry_kwargs = {
            "total": retry_count,
            "backoff_factor": 0.5,
            "status_forcelist": None,
        }

        # urllib3>=1.26 renamed method_whitelist to allowed_methods.
        try:
            retries = Retry(allowed_methods=["POST"], **retry_kwargs)
        except TypeError:
            retries = Retry(method_whitelist=["POST"], **retry_kwargs)

        self.http_session.mount("http://", HTTPAdapter(max_retries=retries))
