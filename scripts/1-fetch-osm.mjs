// Paso 1: baja de OpenStreetMap todas las estatuas de San Martin en Argentina.
//
//   node scripts/1-fetch-osm.mjs   ->   data/statues.raw.json
//
// Esperado: ~6800 memoriales en el pais, ~229 con "San Martin" en el nombre,
// ~220 coordenadas unicas tras deduplicar.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { get, USER_AGENT } from './lib/http.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// El endpoint principal (overpass-api.de) dio timeout con esta consulta.
// kumi.systems la resolvio en ~40s devolviendo 1.5 MB.
const ENDPOINT = 'https://overpass.kumi.systems/api/interpreter';

const QUERY = `[out:json][timeout:240];
area["ISO3166-1"="AR"][admin_level=2]->.ar;
(
  nwr["historic"="memorial"](area.ar);
  nwr["historic"="monument"](area.ar);
  nwr["tourism"="artwork"]["artwork_type"~"statue|bust|sculpture"](area.ar);
);
out center tags;`;

const IS_SAN_MARTIN = /san\s*mart/i;

// Falsos positivos confirmados al inspeccionar los 229 matches: instituciones,
// edificios y una estatua de su esposa. Todos llevan "San Martin" en el nombre
// pero ninguno es un monumento al procer.
const FALSE_POSITIVE =
  /club |cemento|casa de|agujas|referencia hist|remedios escalada|arco |teatro|estaci[oó]n|escuela|hospital/i;

// Placas y estelas no son estatuas: no dan nada que mirar en una foto.
const NOT_A_STATUE = new Set(['plaque', 'stele']);

function coordsOf(el) {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

async function main() {
  console.log('Consultando Overpass (puede tardar ~1 min)...');

  const res = await get(`${ENDPOINT}?data=${encodeURIComponent(QUERY)}`, {
    timeoutMs: 280_000,
  });
  const { elements } = await res.json();
  console.log(`  memoriales/monumentos/esculturas en Argentina: ${elements.length}`);

  const named = elements.filter((el) => {
    const name = el.tags?.name;
    return name && IS_SAN_MARTIN.test(name) && !FALSE_POSITIVE.test(name);
  });
  console.log(`  con "San Martin" en el nombre (sin falsos positivos): ${named.length}`);

  // Deduplicar por coordenada a 4 decimales (~11 m): OSM tiene el mismo busto
  // cargado como node y como way en varios casos.
  const seen = new Map();
  for (const el of named) {
    const c = coordsOf(el);
    if (!c) continue;

    const kind = el.tags.memorial || el.tags.artwork_type || el.tags.historic || 'memorial';
    if (NOT_A_STATUE.has(kind)) continue;

    const key = `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;
    if (seen.has(key)) continue;

    seen.set(key, {
      osmId: `${el.type}/${el.id}`,
      lat: Number(c.lat.toFixed(6)),
      lon: Number(c.lon.toFixed(6)),
      name: el.tags.name,
      kind,
      tags: el.tags,
    });
  }

  const statues = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const lats = statues.map((s) => s.lat);
  const lons = statues.map((s) => s.lon);
  console.log(`  coordenadas unicas: ${statues.length}`);
  console.log(
    `  bbox: lat ${Math.min(...lats).toFixed(2)}..${Math.max(...lats).toFixed(2)}  ` +
      `lon ${Math.min(...lons).toFixed(2)}..${Math.max(...lons).toFixed(2)}`
  );

  await mkdir(resolve(ROOT, 'data'), { recursive: true });
  await writeFile(
    resolve(ROOT, 'data/statues.raw.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), source: 'OpenStreetMap via Overpass', userAgent: USER_AGENT, statues }, null, 2)
  );
  console.log('\nEscrito data/statues.raw.json');
}

main().catch((err) => {
  console.error('\nFallo:', err.message);
  process.exit(1);
});
