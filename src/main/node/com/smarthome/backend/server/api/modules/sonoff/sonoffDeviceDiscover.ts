import os from "node:os";
import mdns from "multicast-dns";
import crypto from "node:crypto";
import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { SonoffDeviceDiscovered } from "./sonoffDeviceDiscovered.js";
import { ModuleDeviceDiscover } from "../moduleDeviceDiscover.js";
import { SONOFFCONFIG, SONOFFMODULE } from "./sonoffModule.js";

type MdnsInstance = ReturnType<typeof mdns>;

type ServiceCache = {
  name: string;
  host?: string;
  port?: number;
  txt?: Record<string, string>;
  ipv4?: string;
};

/** CoolKit `params.configure`: alle Einträge mit `outlet` → eindeutige Kanal-Indexe, aufsteigend. */
function outletIdsFromCloudConfigure(configure: unknown): number[] {
  if (!Array.isArray(configure)) return [];
  const ids = new Set<number>();
  for (const entry of configure) {
    if (!entry || typeof entry !== "object") continue;
    const raw = (entry as Record<string, unknown>).outlet;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      ids.add(Math.trunc(raw));
      continue;
    }
    if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
      ids.add(Number(raw.trim()));
    }
  }
  return [...ids].sort((a, b) => a - b);
}

export type EwelinkCloudCredentials = {
  email: string;
  password: string;
  /** Laendercode fuer Login-Payload / Region-Ableitung, z. B. +49 */
  countryCode: string;
  /** Optional: API-Host-Region (eu|us|as|cn), sonst Ableitung aus countryCode + Redirect */
  region?: string;
  /** Aus Modul-Persistenz: letzter gueltiger Bearer `at` (nur mit passendem Passwort-Fingerprint nutzen). */
  cachedAccessToken?: string;
  cachedApiRegion?: keyof typeof COOLKIT_V2_API_HOST;
  /** Ablaufzeit des Tokens (ms seit Epoch), z. B. aus JWT `exp`. */
  cachedTokenExpiresAtMs?: number;
  /** sha256(Passwort) zum Zeitpunkt der Token-Speicherung — bei geaendertem Passwort neu einloggen. */
  cachedTokenPasswordFingerprint?: string;
};

/** Zum Speichern in `moduleData` nach frischem CoolKit-Login. */
export type EwelinkTokenPersistHint = {
  accessToken: string;
  region: keyof typeof COOLKIT_V2_API_HOST;
  expiresAtMs: number | null;
  passwordFingerprint: string;
};

export type CoolkitV2LoginResult =
  | { ok: true; at: string; userApikey?: string; region: keyof typeof COOLKIT_V2_API_HOST }
  | { ok: false; error: number; msg?: string };

/** DNS-SD-Diensttyp nur als `.local` (keine kurze `_ewelink._tcp`-Variante). */
const EWELINK_PTR_SERVICE = "_ewelink._tcp.local";

/** Auto: scripts/gen_coolkit_regions_repr.py (str(REGIONS) wie SonoffLAN). */
const COOLKIT_REGIONS_PY_REPR = "{'+93': ('Afghanistan', 'as'), '+355': ('Albania', 'eu'), '+213': ('Algeria', 'eu'), '+376': ('Andorra', 'eu'), '+244': ('Angola', 'eu'), '+1264': ('Anguilla', 'us'), '+1268': ('Antigua and Barbuda', 'as'), '+54': ('Argentina', 'us'), '+374': ('Armenia', 'as'), '+297': ('Aruba', 'eu'), '+247': ('Ascension', 'eu'), '+61': ('Australia', 'us'), '+43': ('Austria', 'eu'), '+994': ('Azerbaijan', 'as'), '+1242': ('Bahamas', 'us'), '+973': ('Bahrain', 'as'), '+880': ('Bangladesh', 'as'), '+1246': ('Barbados', 'us'), '+375': ('Belarus', 'eu'), '+32': ('Belgium', 'eu'), '+501': ('Belize', 'us'), '+229': ('Benin', 'eu'), '+1441': ('Bermuda', 'as'), '+591': ('Bolivia', 'us'), '+387': ('Bosnia and Herzegovina', 'eu'), '+267': ('Botswana', 'eu'), '+55': ('Brazil', 'us'), '+673': ('Brunei', 'as'), '+359': ('Bulgaria', 'eu'), '+226': ('Burkina Faso', 'eu'), '+257': ('Burundi', 'eu'), '+855': ('Cambodia', 'as'), '+237': ('Cameroon', 'eu'), '+238': ('Cape Verde Republic', 'eu'), '+1345': ('Cayman Islands', 'as'), '+236': ('Central African Republic', 'eu'), '+235': ('Chad', 'eu'), '+56': ('Chile', 'us'), '+86': ('China', 'cn'), '+57': ('Colombia', 'us'), '+682': ('Cook Islands', 'us'), '+506': ('Costa Rica', 'us'), '+385': ('Croatia', 'eu'), '+53': ('Cuba', 'us'), '+357': ('Cyprus', 'eu'), '+420': ('Czech', 'eu'), '+243': ('Democratic Republic of Congo', 'eu'), '+45': ('Denmark', 'eu'), '+253': ('Djibouti', 'eu'), '+1767': ('Dominica', 'as'), '+1809': ('Dominican Republic', 'us'), '+670': ('East Timor', 'as'), '+684': ('Eastern Samoa (US)', 'us'), '+593': ('Ecuador', 'us'), '+20': ('Egypt', 'eu'), '+503': ('El Salvador', 'us'), '+372': ('Estonia', 'eu'), '+251': ('Ethiopia', 'eu'), '+298': ('Faroe Islands', 'eu'), '+679': ('Fiji', 'us'), '+358': ('Finland', 'eu'), '+33': ('France', 'eu'), '+594': ('French Guiana', 'us'), '+689': ('French Polynesia', 'as'), '+241': ('Gabon', 'eu'), '+220': ('Gambia', 'eu'), '+995': ('Georgia', 'as'), '+49': ('Germany', 'eu'), '+233': ('Ghana', 'eu'), '+350': ('Gibraltar', 'eu'), '+30': ('Greece', 'eu'), '+299': ('Greenland', 'us'), '+1473': ('Grenada', 'as'), '+590': ('Guadeloupe', 'us'), '+1671': ('Guam', 'us'), '+502': ('Guatemala', 'us'), '+240': ('Guinea', 'eu'), '+224': ('Guinea', 'eu'), '+592': ('Guyana', 'us'), '+509': ('Haiti', 'us'), '+504': ('Honduras', 'us'), '+852': ('Hong Kong, China', 'as'), '+36': ('Hungary', 'eu'), '+354': ('Iceland', 'eu'), '+91': ('India', 'as'), '+62': ('Indonesia', 'as'), '+98': ('Iran', 'as'), '+353': ('Ireland', 'eu'), '+269': ('Islamic Federal Republic of Comoros', 'eu'), '+972': ('Israel', 'as'), '+39': ('Italian', 'eu'), '+225': ('Ivory Coast', 'eu'), '+1876': ('Jamaica', 'us'), '+81': ('Japan', 'as'), '+962': ('Jordan', 'as'), '+254': ('Kenya', 'eu'), '+975': ('Kingdom of Bhutan', 'as'), '+383': ('Kosovo', 'eu'), '+965': ('Kuwait', 'as'), '+996': ('Kyrgyzstan', 'as'), '+856': ('Laos', 'as'), '+371': ('Latvia', 'eu'), '+961': ('Lebanon', 'as'), '+266': ('Lesotho', 'eu'), '+231': ('Liberia', 'eu'), '+218': ('Libya', 'eu'), '+423': ('Liechtenstein', 'eu'), '+370': ('Lithuania', 'eu'), '+352': ('Luxembourg', 'eu'), '+853': ('Macau, China', 'as'), '+261': ('Madagascar', 'eu'), '+265': ('Malawi', 'eu'), '+60': ('Malaysia', 'as'), '+960': ('Maldives', 'as'), '+223': ('Mali', 'eu'), '+356': ('Malta', 'eu'), '+596': ('Martinique', 'us'), '+222': ('Mauritania', 'eu'), '+230': ('Mauritius', 'eu'), '+52': ('Mexico', 'us'), '+373': ('Moldova', 'eu'), '+377': ('Monaco', 'eu'), '+976': ('Mongolia', 'as'), '+382': ('Montenegro', 'as'), '+1664': ('Montserrat', 'as'), '+212': ('Morocco', 'eu'), '+258': ('Mozambique', 'eu'), '+95': ('Myanmar', 'as'), '+264': ('Namibia', 'eu'), '+977': ('Nepal', 'as'), '+31': ('Netherlands', 'eu'), '+599': ('Netherlands Antilles', 'as'), '+687': ('New Caledonia', 'as'), '+64': ('New Zealand', 'us'), '+505': ('Nicaragua', 'us'), '+227': ('Niger', 'eu'), '+234': ('Nigeria', 'eu'), '+47': ('Norway', 'eu'), '+968': ('Oman', 'as'), '+92': ('Pakistan', 'as'), '+970': ('Palestine', 'as'), '+507': ('Panama', 'us'), '+675': ('Papua New Guinea', 'as'), '+595': ('Paraguay', 'us'), '+51': ('Peru', 'us'), '+63': ('Philippines', 'as'), '+48': ('Poland', 'eu'), '+351': ('Portugal', 'eu'), '+974': ('Qatar', 'as'), '+242': ('Republic of Congo', 'eu'), '+964': ('Republic of Iraq', 'as'), '+389': ('Republic of Macedonia', 'eu'), '+262': ('Reunion', 'eu'), '+40': ('Romania', 'eu'), '+7': ('Russia', 'eu'), '+250': ('Rwanda', 'eu'), '+1869': ('Saint Kitts and Nevis', 'as'), '+1758': ('Saint Lucia', 'us'), '+1784': ('Saint Vincent', 'as'), '+378': ('San Marino', 'eu'), '+239': ('Sao Tome and Principe', 'eu'), '+966': ('Saudi Arabia', 'as'), '+221': ('Senegal', 'eu'), '+381': ('Serbia', 'eu'), '+248': ('Seychelles', 'eu'), '+232': ('Sierra Leone', 'eu'), '+65': ('Singapore', 'as'), '+421': ('Slovakia', 'eu'), '+386': ('Slovenia', 'eu'), '+27': ('South Africa', 'eu'), '+82': ('South Korea', 'as'), '+34': ('Spain', 'eu'), '+94': ('Sri Lanka', 'as'), '+249': ('Sultan', 'eu'), '+597': ('Suriname', 'us'), '+268': ('Swaziland', 'eu'), '+46': ('Sweden', 'eu'), '+41': ('Switzerland', 'eu'), '+963': ('Syria', 'as'), '+886': ('Taiwan, China', 'as'), '+992': ('Tajikistan', 'as'), '+255': ('Tanzania', 'eu'), '+66': ('Thailand', 'as'), '+228': ('Togo', 'eu'), '+676': ('Tonga', 'us'), '+1868': ('Trinidad and Tobago', 'us'), '+216': ('Tunisia', 'eu'), '+90': ('Turkey', 'as'), '+993': ('Turkmenistan', 'as'), '+1649': ('Turks and Caicos', 'as'), '+44': ('UK', 'eu'), '+256': ('Uganda', 'eu'), '+380': ('Ukraine', 'eu'), '+971': ('United Arab Emirates', 'as'), '+1': ('United States', 'us'), '+598': ('Uruguay', 'us'), '+998': ('Uzbekistan', 'as'), '+678': ('Vanuatu', 'us'), '+58': ('Venezuela', 'us'), '+84': ('Vietnam', 'as'), '+685': ('Western Samoa', 'us'), '+1340': ('Wilk Islands', 'as'), '+967': ('Yemen', 'as'), '+260': ('Zambia', 'eu'), '+263': ('Zimbabwe', 'eu')}";
/* </coolkit-regions-repr> */

/** Python `str(REGIONS)` für CoolKit-Login-Signatur (SonoffDeviceDiscover). */
export function getCoolkitV2RegionsPyReprForSign(): string {
  return COOLKIT_REGIONS_PY_REPR;
}

/** Wie SonoffLAN (AlexxIT): oeffentliche App-ID fuer die CoolKit-v2-API. */
export const COOLKIT_V2_APP_ID = "R8Oq3y0eSZSYdKccHlrQzT1ACCOUT9Gv";

const SIGN_INNER_B64 = "L8KDAMO6wpomxpYZwrHhu4AuEjQKBy8nwoMHNB7DmwoWwrvCsSYGw4wDAxs=";

/** Region -> Host (ohne Slash). */
export const COOLKIT_V2_API_HOST: Record<string, string> = {
  cn: "https://cn-apia.coolkit.cn",
  as: "https://as-apia.coolkit.cc",
  us: "https://us-apia.coolkit.cc",
  eu: "https://eu-apia.coolkit.cc",
};

/**
 * Laendercode (z. B. +49) -> API-Region fuer Host-Auswahl.
 * Auszug aus SonoffLAN cloud.py REGIONS; Fallback eu.
 */
const COUNTRY_TO_REGION: Record<string, string> = {
  "+49": "eu",
  "+43": "eu",
  "+41": "eu",
  "+33": "eu",
  "+39": "eu",
  "+34": "eu",
  "+31": "eu",
  "+32": "eu",
  "+44": "eu",
  "+48": "eu",
  "+420": "eu",
  "+1": "us",
  "+86": "cn",
  "+852": "as",
  "+886": "as",
  "+81": "as",
  "+82": "as",
  "+61": "us",
  "+64": "us",
  "+971": "as",
  "+91": "as",
};

function stripDnsTrailingDot(name: string): string {
  return name.replace(/\.$/, "");
}

function normalizeDnsName(name: string): string {
  return stripDnsTrailingDot(name).toLowerCase();
}

/** PTR-Antwort bezieht sich auf den eWeLink-Diensttyp `_ewelink._tcp.local`. */
function isEwelinkPtrAnswerName(name: unknown): boolean {
  return typeof name === "string" && normalizeDnsName(name) === EWELINK_PTR_SERVICE;
}

/** Instanzname `<host>._ewelink._tcp.local` (nicht der bloße Dienst-PTR). */
function isEwelinkInstanceServiceName(name: string): boolean {
  const n = normalizeDnsName(name);
  const suffix = "._ewelink._tcp.local";
  return n.endsWith(suffix) && n.length > suffix.length;
}

/** Sonoff / eWeLink: mDNS `_ewelink._tcp.local` + optional Cloud-Liste (deviceid ↔ apikey). */
export class SonoffDeviceDiscover extends ModuleDeviceDiscover<SonoffDeviceDiscovered> {
  /** Nur diese PTR-Anfrage; Antworten anderer Diensttypen werden ignoriert. */
  public static PTR_QUERY_NAMES = [EWELINK_PTR_SERVICE] as const;

  private mdnsInstances: MdnsInstance[] = [];
  private mdnsTimers: Array<NodeJS.Timeout> = [];
  private serviceCache = new Map<string, ServiceCache>();
  private devicesMap = new Map<string, SonoffDeviceDiscovered>();
  private cloudCredentials: EwelinkCloudCredentials | null = null;
  private lastEwelinkPersistHint: EwelinkTokenPersistHint | null = null;
  private lastEwelinkAccessTokenForResponse: string | null = null;

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  setEwelinkCloudCredentials(credentials: EwelinkCloudCredentials | null): void {
    this.cloudCredentials = credentials;
  }

  /** Nach Discover: in Modul `moduleData` persistieren, dann zuruecksetzen. */
  takeLastEwelinkPersistHint(): EwelinkTokenPersistHint | null {
    const h = this.lastEwelinkPersistHint;
    this.lastEwelinkPersistHint = null;
    return h;
  }

  /** Bearer-Token fuer API-Antwort (Cache oder frisch); nach Lesen zuruecksetzen. */
  takeLastEwelinkAccessTokenForResponse(): string | null {
    const t = this.lastEwelinkAccessTokenForResponse;
    this.lastEwelinkAccessTokenForResponse = null;
    return t;
  }

  getModuleName(): string {
    return SONOFFMODULE.name;
  }

  getDiscoveredDeviceTypeName(): string {
    return SONOFFCONFIG.deviceTypeName;
  }

  public async startDiscovery(timeoutSeconds: number): Promise<SonoffDeviceDiscovered[]> {
    this.devicesMap.clear();
    this.serviceCache.clear();

    const cloudPromise = this.fetchEwelinkCloudDevices();

    this.startMdnsDiscovery();
    await new Promise(resolve => setTimeout(resolve, Math.max(timeoutSeconds, 1) * 1000));
    this.stopMdnsDiscovery();

    const cloudList = await cloudPromise;
    this.mergeCloudDevices(cloudList);

    return Array.from(this.devicesMap.values());
  }

  public async stopDiscovery(): Promise<void> {
    this.stopMdnsDiscovery();
  }

  private async fetchEwelinkCloudDevices(): Promise<SonoffDeviceDiscovered[]> {
    const creds = this.cloudCredentials;
    if (!creds?.email?.trim() || !creds.password) {
      return [];
    }

    this.lastEwelinkPersistHint = null;
    this.lastEwelinkAccessTokenForResponse = null;

    try {
      const r = creds.region?.trim();
      const preferred =
        r && r in COOLKIT_V2_API_HOST ? (r as keyof typeof COOLKIT_V2_API_HOST) : undefined;

      const passwordFp = ewelinkPasswordFingerprint(creds.password);

      const cacheOk =
        !!creds.cachedAccessToken?.trim() &&
        creds.cachedApiRegion != null &&
        creds.cachedApiRegion in COOLKIT_V2_API_HOST &&
        creds.cachedTokenPasswordFingerprint === passwordFp &&
        !isEwelinkAccessTokenExpired(creds.cachedTokenExpiresAtMs);

      if (cacheOk && creds.cachedAccessToken && creds.cachedApiRegion) {
        const devCached = await this.coolkitV2FetchDevices(creds.cachedApiRegion, creds.cachedAccessToken);
        if (devCached.ok) {
          this.lastEwelinkAccessTokenForResponse = creds.cachedAccessToken;
          return this.mapCloudThingList(devCached.items);
        }
        if (!devCached.authFailure) {
          return [];
        }
        logger.info("CoolKit v2: gespeicherter Token ungueltig/abgelaufen — erneuter Login");
      }

      const login = await this.coolkitV2Login(
        creds.email,
        creds.password,
        creds.countryCode || "+49",
        preferred
      );
      if (!login.ok) {
        return [];
      }

      const expiresAtMs = coolkitJwtExpiryMs(login.at);

      this.lastEwelinkPersistHint = {
        accessToken: login.at,
        region: login.region,
        expiresAtMs,
        passwordFingerprint: passwordFp,
      };
      this.lastEwelinkAccessTokenForResponse = login.at;

      const devRes = await this.coolkitV2FetchDevices(login.region, login.at);
      if (!devRes.ok) {
        this.lastEwelinkPersistHint = null;
        this.lastEwelinkAccessTokenForResponse = null;
        return [];
      }

      return this.mapCloudThingList(devRes.items);
    } catch (err) {
      logger.error({ err }, "CoolKit v2 Cloud-Anfrage fehlgeschlagen");
      return [];
    }
  }

  private mapCloudThingList(items: Record<string, unknown>[]): SonoffDeviceDiscovered[] {
    const out: SonoffDeviceDiscovered[] = [];
    for (const item of items) {
      const d = this.cloudRecordToDiscovered(item);
      if (d) out.push(d);
    }
    logger.info({ count: out.length }, "CoolKit v2: Geraete mit API-Keys geladen");
    return out;
  }

  private async coolkitV2Login(
    email: string,
    password: string,
    countryCode: string,
    preferredRegion?: keyof typeof COOLKIT_V2_API_HOST
  ): Promise<CoolkitV2LoginResult> {
    let region: keyof typeof COOLKIT_V2_API_HOST =
      preferredRegion && preferredRegion in COOLKIT_V2_API_HOST
        ? preferredRegion
        : coolkitV2RegionForCountry(countryCode);
    const host = COOLKIT_V2_API_HOST[region];
    if (!host) {
      return { ok: false, error: -1, msg: "Unbekannte CoolKit-Region" };
    }

    const payload = { email: email.trim(), password, countryCode: countryCode.trim() };
    const bodyStr = JSON.stringify(payload);
    const bodyBuf = Buffer.from(bodyStr, "utf8");

    const signB64 = coolkitV2SignRequestBody(bodyBuf, getCoolkitV2RegionsPyReprForSign());

    const doPost = async (apiHost: string) =>
      fetch(`${apiHost}/v2/user/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Sign ${signB64}`,
          "X-CK-Appid": COOLKIT_V2_APP_ID,
        },
        body: bodyStr,
        signal: AbortSignal.timeout(25_000),
      });

    try {
      let res = await doPost(host);
      let json = (await res.json()) as Record<string, unknown>;

      const errFirst = typeof json.error === "number" ? json.error : Number(json.error);
      if (errFirst === 10004 && json.data && typeof json.data === "object") {
        const data = json.data as Record<string, unknown>;
        const redirect = typeof data.region === "string" ? data.region : null;
        if (redirect && redirect in COOLKIT_V2_API_HOST) {
          region = redirect as keyof typeof COOLKIT_V2_API_HOST;
          res = await doPost(COOLKIT_V2_API_HOST[region]);
          json = (await res.json()) as Record<string, unknown>;
        }
      }

      const err = typeof json.error === "number" ? json.error : Number(json.error);
      if (err !== 0) {
        logger.warn({ error: err, msg: json.msg }, "CoolKit v2 Login fehlgeschlagen");
        return { ok: false, error: err, msg: String(json.msg ?? "") };
      }

      const data = json.data as Record<string, unknown> | undefined;
      if (!data || typeof data !== "object") {
        return { ok: false, error: -2, msg: "Login-Antwort ohne data" };
      }
      const at = typeof data.at === "string" ? data.at : "";
      if (!at) {
        return { ok: false, error: -2, msg: "Login-Antwort ohne Access-Token (at)" };
      }

      const user = data.user as Record<string, unknown> | undefined;
      const userApikey = typeof user?.apikey === "string" ? user.apikey : undefined;

      return { ok: true, at, userApikey, region };
    } catch (e) {
      logger.error({ e }, "CoolKit v2 Login Netzwerkfehler");
      return { ok: false, error: -3, msg: e instanceof Error ? e.message : String(e) };
    }
  }

  /** CoolKit v2 GET `/v2/device/thing` — flacht `itemData`-Einträge für die Cloud-Discovery auf. */
  private async coolkitV2FetchDevices(
    region: keyof typeof COOLKIT_V2_API_HOST,
    accessToken: string
  ): Promise<
    | { ok: true; items: Record<string, unknown>[] }
    | { ok: false; error: number; msg?: string; authFailure: boolean }
  > {
    const host = COOLKIT_V2_API_HOST[region];
    const url = `${host}/v2/device/thing?num=0`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-CK-Appid": COOLKIT_V2_APP_ID,
        },
        signal: AbortSignal.timeout(25_000),
      });

      const httpStatus = res.status;
      const json = (await res.json()) as Record<string, unknown>;
      const err = typeof json.error === "number" ? json.error : Number(json.error);
      if (err !== 0) {
        logger.warn({ error: err, msg: json.msg }, "CoolKit v2 device/thing fehlgeschlagen");
        return {
          ok: false,
          error: err,
          msg: String(json.msg ?? ""),
          authFailure: isCoolkitAuthFailure(httpStatus, err),
        };
      }

      const data = json.data as Record<string, unknown> | undefined;
      const thingList = data?.thingList;
      if (!Array.isArray(thingList)) {
        return { ok: true, items: [] };
      }

      const items: Record<string, unknown>[] = [];
      for (const entry of thingList) {
        if (!entry || typeof entry !== "object") continue;
        const itemData = (entry as Record<string, unknown>).itemData;
        if (!itemData || typeof itemData !== "object") continue;
        const id = (itemData as Record<string, unknown>).deviceid;
        if (typeof id === "string") {
          items.push({ ...(itemData as Record<string, unknown>) });
        }
      }

      return { ok: true, items };
    } catch (e) {
      logger.error({ e }, "CoolKit v2 device/thing Netzwerkfehler");
      return { ok: false, error: -3, msg: e instanceof Error ? e.message : String(e), authFailure: false };
    }
  }

  private getDeviceId(eweLinkDeviceId: string): string {
    return `sonoff-${eweLinkDeviceId}`;
  }

  private cloudRecordToDiscovered(d: Record<string, unknown>): SonoffDeviceDiscovered | null {
    const deviceid = d.deviceid as string | undefined;
    const apikey = d.devicekey as string | undefined;
    if (deviceid === undefined || apikey === undefined) return null;

    const params = d.params as Record<string, unknown> | undefined;
    const configure = params?.configure;
    const outletIdsArr =
      Array.isArray(configure) && configure.length > 0 ? outletIdsFromCloudConfigure(configure) : [0];
    /** Ohne `configure` / ohne erkannte `outlet`-Einträge: ein Kanal mit Sentinel-ID -1 (Simple-Switch). */
    const outletIds = outletIdsArr.length > 0 ? outletIdsArr : [-1];

    const extra = d.extra as Record<string, unknown>;
    const brandName = d.brandName as string | undefined ?? "";
    const productModel = d.productModel as string | undefined ?? "";
    const name = d.name as string | undefined ?? productModel ?? extra?.model as string | undefined ?? `Sonoff ${deviceid ?? ""}`;
    const ewelinkModelInfo = extra?.modelInfo as string | undefined ?? "";
    const ewelinkMac = extra?.mac as string | undefined ?? "";
    const vendorId = extra?.brandId as string | undefined ?? "";
    const productId = extra?.uiid as string | undefined ?? "";

    const id = this.getDeviceId(deviceid);
    return new SonoffDeviceDiscovered({
      id,
      name,
      address: "",
      port: 8081,
      ewelinkDeviceId: deviceid,
      vendorId,
      productId,
      brandName,
      productModel,
      ewelinkModelInfo,
      ewelinkMac,
      apiKey: apikey || undefined,
      txtRecord: undefined,
      isPaired: false,
      outletIds,
    });
  }

  private mergeCloudDevices(cloudDevices: SonoffDeviceDiscovered[]) {
    for (const cloud of cloudDevices) {
      const existing = this.devicesMap.get(cloud.id);
      if (existing) {
        if (cloud.apiKey) existing.apiKey = cloud.apiKey;
        if (!existing.name || existing.name.length === 0) existing.name = cloud.name;
        if (!existing.ewelinkDeviceId && cloud.ewelinkDeviceId) existing.ewelinkDeviceId = cloud.ewelinkDeviceId;
        if (!existing.vendorId && cloud.vendorId) existing.vendorId = cloud.vendorId;
        if (!existing.productId && cloud.productId) existing.productId = cloud.productId;
        if (!existing.address && cloud.address) existing.address = cloud.address;
        if (!existing.brandName && cloud.brandName) existing.brandName = cloud.brandName;
        if (!existing.productModel && cloud.productModel) existing.productModel = cloud.productModel;
        if (!existing.ewelinkModelInfo && cloud.ewelinkModelInfo) existing.ewelinkModelInfo = cloud.ewelinkModelInfo;
        if (!existing.ewelinkMac && cloud.ewelinkMac) existing.ewelinkMac = cloud.ewelinkMac;
        if (cloud.outletIds && cloud.outletIds.length > 0) existing.outletIds = cloud.outletIds;
        continue;
      }
      this.devicesMap.set(cloud.id, cloud);
    }
  }

  private startMdnsDiscovery() {
    this.stopMdnsDiscovery();
    const interfaces = os.networkInterfaces();
    Object.values(interfaces).forEach(iface => {
      (iface ?? []).forEach(addr => {
        if (addr.internal) return;
        if (addr.family !== "IPv4") return;
        try {
          const instance = mdns({ interface: addr.address });
          this.mdnsInstances.push(instance);
          instance.on("response", (response: any) => this.handleMdnsResponse(response));
          const query = () => {
            instance.query({
              questions: SonoffDeviceDiscover.PTR_QUERY_NAMES.map(name => ({ name, type: "PTR" })),
            });
          };
          query();
          const timer = setInterval(query, 2000);
          this.mdnsTimers.push(timer);
          logger.info({ iface: addr.address, ptr: SonoffDeviceDiscover.PTR_QUERY_NAMES }, "Sonoff mDNS Discovery gestartet");
        } catch (err) {
          logger.warn({ err, iface: addr.address }, "Sonoff mDNS konnte nicht gestartet werden");
        }
      });
    });
    if (this.mdnsInstances.length === 0) {
      logger.warn("Keine mDNS-Instanz fuer Sonoff-Discovery erzeugt");
    }
  }

  private stopMdnsDiscovery() {
    this.mdnsTimers.forEach(t => clearInterval(t));
    this.mdnsTimers = [];
    this.mdnsInstances.forEach(instance => {
      try {
        instance.removeAllListeners();
        instance.destroy();
      } catch (err) {
        logger.warn({ err }, "Fehler beim Schliessen von Sonoff mDNS");
      }
    });
    this.mdnsInstances = [];
  }

  private handleMdnsResponse(response: { answers?: any[]; additionals?: any[] }) {
    const records = [...(response.answers ?? []), ...(response.additionals ?? [])];
    for (const record of records) {
      if (record.type === "PTR" && typeof record.data === "string") {
        if (!isEwelinkPtrAnswerName(record.name)) continue;
        const instance = stripDnsTrailingDot(record.data);
        if (!isEwelinkInstanceServiceName(instance)) continue;
        this.ensureService(instance);
      }
      if (record.type === "SRV" && record.name) {
        const inst = stripDnsTrailingDot(record.name as string);
        if (!isEwelinkInstanceServiceName(inst)) continue;
        const entry = this.ensureService(inst);
        const dv = record.data as { target?: string; port?: number } | undefined;
        entry.host = dv?.target ? stripDnsTrailingDot(dv.target) : dv?.target;
        entry.port = dv?.port;
      }
      if (record.type === "TXT" && record.name) {
        const inst = stripDnsTrailingDot(record.name as string);
        if (!isEwelinkInstanceServiceName(inst)) continue;
        const entry = this.ensureService(inst);
        const parsed = this.parseTxt(record.data as Buffer[] | unknown[]);
        entry.txt = { ...(entry.txt ?? {}), ...parsed };
      }
      if (record.type === "A" && record.name) {
        const host = stripDnsTrailingDot(record.name as string);
        const entry = this.findServiceByHost(host);
        if (entry) entry.ipv4 = record.data as string;
      }
    }

    for (const [name, service] of this.serviceCache.entries()) {
        this.tryCreateDevice(service);
    }
  }

  private ensureService(name: string) {
    if (!this.serviceCache.has(name)) {
      this.serviceCache.set(name, { name });
    }
    return this.serviceCache.get(name)!;
  }

  private findServiceByHost(host: string) {
    const h = normalizeDnsName(host);
    for (const service of this.serviceCache.values()) {
      if (service.host && normalizeDnsName(service.host) === h) return service;
    }
    return undefined;
  }

  private parseTxt(data: Buffer[] | unknown[] | undefined): Record<string, string> {
    const txt: Record<string, string> = {};
    (data ?? []).forEach(entry => {
      let text: string;
      if (Buffer.isBuffer(entry)) {
        text = entry.toString("utf8");
      } else if (
        entry &&
        typeof entry === "object" &&
        "type" in entry &&
        (entry as { type: string }).type === "Buffer" &&
        Array.isArray((entry as unknown as { data: number[] }).data)
      ) {
        text = Buffer.from((entry as unknown as { data: number[] }).data).toString("utf8");
      } else {
        text = String(entry ?? "");
      }
      const eqIdx = text.indexOf("=");
      if (eqIdx > 0) {
        const key = text.substring(0, eqIdx);
        const value = text.substring(eqIdx + 1);
        if (key) txt[key] = value;
      } else if (text.trim()) {
        txt[text.trim()] = "";
      }
    });
    return txt;
  }

  private tryCreateDevice(service: ServiceCache) {
    const ipv4 = service.ipv4;
    const port = service.port ?? 8081;
    if (!ipv4) return;

    const txt = service.txt ?? {};
    const ewelinkId = txt.id as string | undefined;
    if( !ewelinkId ) return;
    const id = this.getDeviceId(ewelinkId);

    if (this.devicesMap.has(id)) {
      const existing = this.devicesMap.get(id)!;
      if (!existing.address) existing.address = ipv4;
      if(!existing.port) existing.port = port;
      if (!existing.ewelinkDeviceId && ewelinkId) existing.ewelinkDeviceId = ewelinkId;
      return;
    }

    const device = new SonoffDeviceDiscovered({
      id,
      name: "",
      address: ipv4,
      port,
      ewelinkDeviceId: ewelinkId,
      isPaired: false,
    });

    this.devicesMap.set(id, device);
  }
}

export function ewelinkPasswordFingerprint(password: string): string {
  return crypto.createHash("sha256").update(password, "utf8").digest("hex");
}

function coolkitJwtExpiryMs(accessToken: string): number | null {
  const parts = accessToken.split(".");
  if (parts.length < 2) return null;
  try {
    const payloadJson = Buffer.from(parts[1]!, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isEwelinkAccessTokenExpired(expiresAtMs: number | null | undefined): boolean {
  if (expiresAtMs == null) return false;
  return Date.now() >= expiresAtMs - 60_000;
}

function isCoolkitAuthFailure(httpStatus: number, errorCode: number): boolean {
  if (httpStatus === 401 || httpStatus === 403) return true;
  const authCodes = new Set([401, 402, 403, 406, 40001, 40003, 10001, 10002]);
  return authCodes.has(errorCode);
}

function coolkitV2RegionForCountry(countryCode: string): keyof typeof COOLKIT_V2_API_HOST {
  const key = countryCode.trim();
  const r = COUNTRY_TO_REGION[key];
  if (r === "eu" || r === "us" || r === "as" || r === "cn") return r;
  return "eu";
}

/**
 * HMAC-Signatur fuer POST /v2/user/login (wie SonoffLAN `sign`, Fallback-Zweig).
 */
function coolkitV2SignRequestBody(bodyUtf8: Buffer, regionsPyReprUtf8: string): string {
  const regionsNorm = regionsPyReprUtf8.replace(/^\uFEFF/, "").trim();
  const a = Buffer.from(Buffer.from(regionsNorm, "utf8").toString("base64"), "utf8");
  const inner = Buffer.from(SIGN_INNER_B64, "base64").toString("utf8");
  const key = Buffer.allocUnsafe(inner.length);
  for (let i = 0; i < inner.length; i++) {
    key[i] = a[inner.charCodeAt(i)]!;
  }
  const hmac = crypto.createHmac("sha256", key).update(bodyUtf8).digest();
  return Buffer.from(hmac).toString("base64");
}


