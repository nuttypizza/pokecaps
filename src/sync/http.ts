const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const REQUEST_TIMEOUT_MS = 30_000; // healthy API responses take about 3s
const MAX_RETRY_AFTER_S = 60;

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  { attempts = 5, baseDelayMs = 2000 } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let retryAfterMs = 0;
    try {
      const { status, body, retryAfter } = await withTimeout(once(url, init), REQUEST_TIMEOUT_MS, url);
      if (process.env.SYNC_DEBUG) console.log(`    ${status} ${url} (attempt ${attempt})`);
      if (status >= 200 && status < 300) return body as T;
      lastError = new Error(`HTTP ${status} for ${url}`);
      if (!RETRYABLE.has(status)) break;
      retryAfterMs = Math.min(retryAfter, MAX_RETRY_AFTER_S) * 1000;
    } catch (err) {
      lastError = err;
    }
    if (attempt < attempts) await sleep(Math.max(retryAfterMs, baseDelayMs * 2 ** (attempt - 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function once(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const retryAfter = Number(res.headers.get("retry-after")) || 0;
    if (!res.ok) {
      // Always drain error bodies, or undici keeps the connection busy and later requests stall.
      await res.body?.cancel().catch(() => {});
      return { status: res.status, body: null, retryAfter };
    }
    return { status: res.status, body: (await res.json()) as unknown, retryAfter };
  } finally {
    clearTimeout(timer);
  }
}

/** Hard deadline in case a request hangs somewhere the abort signal doesn't reach (e.g. a proxy CONNECT). */
function withTimeout<T>(p: Promise<T>, ms: number, url: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s: ${url}`)), ms + 5_000);
  });
  return Promise.race([p, deadline]).finally(() => clearTimeout(timer));
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
