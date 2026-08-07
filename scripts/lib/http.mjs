// Helpers de red compartidos por el pipeline de datos.
//
// Wikimedia y Nominatim bloquean con 429 a los clientes sin User-Agent
// descriptivo: durante la investigacion previa el UA por defecto de Node
// empezo a recibir 429 tras ~10 requests. UA + throttle no son opcionales.

export const USER_AGENT =
  'SanMartinGeoGame/0.1 (proyecto educativo; https://github.com/local/geosanmartin)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET con reintentos y backoff exponencial ante 429/5xx.
 * @returns {Promise<Response>}
 */
export async function get(url, { retries = 4, timeoutMs = 60_000 } = {}) {
  let wait = 1000;

  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' },
        signal: ctrl.signal,
      });

      if (res.ok) return res;
      if (attempt >= retries || (res.status !== 429 && res.status < 500)) {
        throw new Error(`HTTP ${res.status} en ${url}`);
      }
      // 429 suele traer Retry-After; respetarlo evita que nos sigan bloqueando.
      const retryAfter = Number(res.headers.get('retry-after')) * 1000;
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : wait);
      wait *= 2;
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(wait);
      wait *= 2;
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function getJson(url, opts) {
  return (await get(url, opts)).json();
}

/** Limita a `perSecond` requests por segundo, en serie. */
export function throttle(perSecond = 1) {
  const minGap = 1000 / perSecond;
  let last = 0;
  return async () => {
    const gap = Date.now() - last;
    if (gap < minGap) await sleep(minGap - gap);
    last = Date.now();
  };
}

/** Barra de progreso de una linea, para scripts que tardan minutos. */
export function progress(total, label = '') {
  let done = 0;
  return (suffix = '') => {
    done++;
    const pct = ((done / total) * 100).toFixed(0).padStart(3);
    process.stdout.write(`\r  ${label} ${pct}% (${done}/${total}) ${suffix.slice(0, 50).padEnd(52)}`);
    if (done === total) process.stdout.write('\n');
  };
}
