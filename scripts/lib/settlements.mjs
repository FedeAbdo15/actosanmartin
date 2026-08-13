// Localidades argentinas con poblacion, desde OSM.
//
// Se usa para validar el nombre que devolvio Nominatim: se matchea por cercania
// geografica, no por nombre, que es mucho mas confiable (Nominatim devuelve
// cosas como "Mercado de la Ciudad" o "Pedania Los Reartes" en vez de la
// ciudad). El tamano de la localidad queda en data/curation.json como dato para
// quien cura las fotos; el juego ya no lo usa como pista.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { get } from './http.mjs';

const ENDPOINT = 'https://overpass.kumi.systems/api/interpreter';

const QUERY = `[out:json][timeout:240];
area["ISO3166-1"="AR"][admin_level=2]->.ar;
(
  node["place"~"^(city|town|village)$"]["name"](area.ar);
);
out body;`;

const EARTH_KM = 6371;
const toRad = (d) => (d * Math.PI) / 180;

function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Descarga (y cachea) las localidades argentinas. */
export async function loadSettlements(cachePath) {
  if (existsSync(cachePath)) {
    return JSON.parse(await readFile(cachePath, 'utf8')).settlements;
  }

  console.log('Bajando localidades argentinas de OSM...');
  const res = await get(`${ENDPOINT}?data=${encodeURIComponent(QUERY)}`, { timeoutMs: 280_000 });
  const { elements } = await res.json();

  const settlements = elements
    .filter((e) => e.tags?.name && Number.isFinite(e.lat))
    .map((e) => ({
      name: e.tags.name,
      lat: e.lat,
      lon: e.lon,
      place: e.tags.place,
      population: Number(String(e.tags.population ?? '').replace(/\D/g, '')) || null,
    }));

  console.log(`  ${settlements.length} localidades (${settlements.filter((s) => s.population).length} con poblacion)`);
  await writeFile(cachePath, JSON.stringify({ generatedAt: new Date().toISOString(), settlements }, null, 2));
  return settlements;
}

/** Localidad mas cercana al punto, dentro de `maxKm`. */
export function nearestSettlement(point, settlements, maxKm = 25) {
  let best = null;
  let bestDist = Infinity;

  for (const s of settlements) {
    // Filtro barato antes de la trigonometria.
    if (Math.abs(s.lat - point.lat) > 0.4 || Math.abs(s.lon - point.lon) > 0.4) continue;
    const d = distanceKm(point, s);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return bestDist <= maxKm ? { ...best, distanceKm: bestDist } : null;
}
