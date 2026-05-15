/** BMW CarData OAuth + Streaming defaults (siehe BMW CarData Integration / Community-POCs). */

export const BMW_CARDATA_DEVICE_CODE_URL = "https://customer.bmwgroup.com/gcdm/oauth/device/code";
export const BMW_CARDATA_TOKEN_URL = "https://customer.bmwgroup.com/gcdm/oauth/token";
/** Streaming-only (wie MQTTX/curl); cardata:api:read nur bei REST-Bedarf ergaenzen. */
export const BMW_CARDATA_SCOPE =
  "authenticate_user openid cardata:streaming:read";

export const BMW_CARDATA_DEFAULT_MQTT_HOST = "customer.streaming-cardata.bmwgroup.com";
export const BMW_CARDATA_DEFAULT_MQTT_PORT = 9000;

/** MQTT Keepalive <= 30s empfohlen (Broker trennt nach ~60s ohne Ping). */
export const BMW_CARDATA_MQTT_KEEPALIVE = 30;

/** Discovery: VINs aus MQTT sammeln, max. Wartezeit. */
export const BMW_CARDATA_DISCOVERY_TIMEOUT_MS = 55_000;
