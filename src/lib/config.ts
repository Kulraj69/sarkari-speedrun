/**
 * Limits, model ids, and list prices for Sarkari Speedrun.
 * Prices are public Token Factory catalog rates (USD per 1M tokens), used only
 * as an on-screen estimate. They are not an invoice.
 */

export const APP_NAME = "Sarkari Speedrun";

export const DEFAULT_NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1";

export const NANO_MODEL_ID = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";
export const SUPER_MODEL_ID = "nvidia/nemotron-3-super-120b-a12b";
export const ULTRA_MODEL_ID = "nvidia/Nemotron-3-Ultra-550b-a55b";

export const NANO_MODEL_LABEL = "Nemotron 3 Nano 30B";
export const SUPER_MODEL_LABEL = "Nemotron 3 Super 120B";
export const ULTRA_MODEL_LABEL = "Nemotron 3 Ultra 550B";
export const TAVILY_LABEL = "Tavily Search";

export const PROVIDER_TOKEN_FACTORY = "Nebius Token Factory";
export const PROVIDER_TAVILY = "Tavily";
export const PROVIDER_FIXTURE = "Sample fixture";

export const NANO_INPUT_USD_PER_MILLION = 0.06;
export const NANO_OUTPUT_USD_PER_MILLION = 0.24;
export const ULTRA_INPUT_USD_PER_MILLION = 1;
export const ULTRA_OUTPUT_USD_PER_MILLION = 3;
export const SUPER_INPUT_USD_PER_MILLION = 0.3;
export const SUPER_OUTPUT_USD_PER_MILLION = 0.9;

export const MAX_INPUT_CHARS = 2_000;
export const MAX_QUESTIONS = 4;
export const MAX_ITEMS = 8;
export const MIN_QUOTE_CHARS = 12;
export const SNIPPET_CHARS = 480;
export const EXTRACT_SNIPPET_CHARS = 1_600;
export const CHECKLIST_MAX_CHARS = 1_200;

export const TAVILY_MAX_RESULTS = 4;
export const TAVILY_SEARCH_DEPTH = "basic";
export const TAVILY_TIME_RANGE = "year";
export const TAVILY_CONCURRENCY = 3;
export const MIN_OFFICIAL_HITS = 1;
export const EXTRACT_TOP_URLS = 3;

export const NANO_PLAN_TEMPERATURE = 0.1;
export const NANO_CHECKLIST_TEMPERATURE = 0.3;
export const NANO_REWRITE_TEMPERATURE = 0.2;
export const CHECK_TEMPERATURE = 0.1;
export const NANO_PLAN_MAX_TOKENS = 800;
export const REWRITE_MAX_TOKENS = 180;
export const CHECK_MAX_TOKENS = 3_000;
export const CHECKLIST_MAX_TOKENS = 900;

export const NANO_TIMEOUT_MS = 45_000;
export const CHECK_TIMEOUT_MS = 55_000;
export const TAVILY_TIMEOUT_MS = 20_000;
export const TAVILY_EXTRACT_TIMEOUT_MS = 8_000;

export const LOW_CONFIDENCE_CAP = 0.3;
/** One rewrite-and-recheck when the weakest surviving item is below this. */
export const CONFIDENCE_RETRY_BELOW = 0.55;

export const OFFICIAL_INCLUDE_DOMAINS = [
  "passportindia.gov.in",
  "uidai.gov.in",
  "parivahan.gov.in",
  "incometax.gov.in",
  "incometaxindia.gov.in",
  "eci.gov.in",
  "voters.eci.gov.in",
  "india.gov.in",
  "punjab.gov.in",
  "eservices.punjab.gov.in",
  "mea.gov.in",
  "nic.in",
  "gov.in",
] as const;

export const RECORDED_LATENCY_MS = {
  plan: 640,
  evidence: [420, 380, 450, 410],
  settle: 1_760,
  checklist: 690,
} as const;

export const PRESENTATION_DELAY_MS = {
  meta: 120,
  plan: 180,
  evidence: 160,
  item: 140,
  checklist: 100,
} as const;

export const ITEM_KINDS = ["step", "document", "fee", "office", "time", "change"] as const;

export const DEMO_URL_PLACEHOLDER = "https://sarkari-speedrun-demo.example.com";

export const HTTP_STATUS = {
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  tooMany: 429,
  server: 500,
  badGateway: 502,
  unavailable: 503,
  timeout: 504,
} as const;

export const FALLBACK_STATUSES: readonly number[] = [
  HTTP_STATUS.notFound,
  HTTP_STATUS.tooMany,
  HTTP_STATUS.server,
  HTTP_STATUS.badGateway,
  HTTP_STATUS.unavailable,
  HTTP_STATUS.timeout,
];

/** A recent-change flag stays up only when the quoted line itself signals a revision or a year. */
export const CHANGE_SIGNAL =
  /\b(20\d{2}|revis\w*|amend\w*|notification|extended|no longer|w\.e\.f|with effect)\b/i;
/** The service's own portals, searched first so a generic gov.in page does not crowd them out. */
const FOCUS_DOMAINS: ReadonlyArray<[RegExp, readonly string[]]> = [
  [/passport/i, ["passportindia.gov.in", "mea.gov.in"]],
  [/licen[cs]e|\bdl\b|driving|vehicle|\brc\b/i, ["parivahan.gov.in", "sarathi.parivahan.gov.in", "morth.nic.in", "punjabtransport.org"]],
  [/voter|epic|electoral/i, ["eci.gov.in", "voters.eci.gov.in", "ceopunjab.gov.in"]],
  [/\bpan\b|income tax/i, ["incometax.gov.in", "incometaxindia.gov.in", "protean-tinpan.com", "uidai.gov.in"]],
  [/aadhaar|aadhar/i, ["uidai.gov.in", "myaadhaar.uidai.gov.in"]],
  [/birth|death/i, ["crsorgi.gov.in", "censusindia.gov.in"]],
  [/residen|domicile|income certificate|caste|sewa/i, ["connect.punjab.gov.in", "esewa.punjab.gov.in", "punjab.gov.in", "dgrpg.punjab.gov.in"]],
];

export function focusDomains(task: string, city: string): string[] | undefined {
  for (const [pattern, domains] of FOCUS_DOMAINS) {
    if (pattern.test(task)) {
      void city;
      return [...domains];
    }
  }
  return undefined;
}
