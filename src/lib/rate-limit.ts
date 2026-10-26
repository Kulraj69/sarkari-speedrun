// In-memory limits on live runs. Each serverless instance keeps its own
// counts, so these are soft caps, but they bound what one visitor can spend.

export const PER_IP_LIMIT = 5;
export const PER_IP_WINDOW_MS = 60 * 60 * 1000;
export const DAILY_LIMIT = 200;

export type LimitResult = { ok: true; used?: number } | { ok: false; note: string };

export const IP_NOTE =
  "You have used your 5 live checks for this hour. This one uses the cached demos instead, so no live search ran. Try again within the hour.";
export const DAY_NOTE =
  "The site has used today's 200 live checks. This one uses the cached demos instead, so no live search ran. Live checks start again tomorrow (UTC).";

export class LiveLimiter {
  private hits = new Map<string, number[]>();
  private day = "";
  private dayCount = 0;

  constructor(
    private perIp = PER_IP_LIMIT,
    private windowMs = PER_IP_WINDOW_MS,
    private daily = DAILY_LIMIT,
  ) {}

  take(ip: string, now: number): LimitResult {
    const today = new Date(now).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.dayCount = 0;
    }
    if (this.dayCount >= this.daily) return { ok: false, note: DAY_NOTE };

    const recent = (this.hits.get(ip) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.perIp) {
      this.hits.set(ip, recent);
      return { ok: false, note: IP_NOTE };
    }
    recent.push(now);
    this.hits.set(ip, recent);
    this.dayCount += 1;
    if (this.hits.size > 10_000) this.prune(now);
    return { ok: true, used: recent.length };
  }

  private prune(now: number) {
    for (const [ip, times] of this.hits) {
      if (!times.some((t) => now - t < this.windowMs)) this.hits.delete(ip);
    }
  }
}

export const INSTANCE_ID = Math.random().toString(36).slice(2, 8);

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

export const liveLimiter = new LiveLimiter(
  envInt("LIVE_PER_IP_LIMIT", PER_IP_LIMIT),
  PER_IP_WINDOW_MS,
  envInt("LIVE_DAILY_LIMIT", DAILY_LIMIT),
);

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
