// Paso 2: para cada estatua resuelve su localidad y busca fotos candidatas
// en Wikimedia Commons.
//
//   node scripts/2-find-photos.mjs   ->   data/candidates.json
//
// Tarda ~10 min por el throttle de 1 req/s que exigen Nominatim y Commons.
// Cachea en disco: volver a correrlo solo pide lo que falta.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getJson, throttle, progress } from './lib/http.mjs';
import { loadSettlements, nearestSettlement } from './lib/settlements.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, 'data/candidates.json');

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

// Nominatim exige <=1 req/s. Commons tolera mas pero devolvio 429 en pruebas
// a ~5 req/s, asi que 1 req/s en ambos.
const wait = throttle(1);

async function reverseGeocode({ lat, lon }) {
  const url =
    `${NOMINATIM}?lat=${lat}&lon=${lon}&format=json&zoom=12&addressdetails=1&accept-language=es`;
  await wait();
  const j = await getJson(url);
  const a = j.address ?? {};
  return {
    locality: a.city || a.town || a.village || a.municipality || a.county || null,
    province: a.state || null,
  };
}

async function runSearch(query) {
  const url =
    `${COMMONS}?action=query&list=search&srsearch=${encodeURIComponent(query)}` +
    `&srnamespace=6&srlimit=8&format=json&origin=*`;
  await wait();
  const j = await getJson(url);
  return (j.query?.search ?? []).map((h) => ({
    title: h.title.replace(/^File:/, ''),
    snippet: h.snippet.replace(/<[^>]+>/g, '').slice(0, 160),
    query,
  }));
}

/**
 * Busqueda de alta precision.
 *
 * La busqueda libre ("Monumento San Martin <ciudad>") tiene ~20% de precision:
 * devuelve PDFs de libros espanoles del siglo XIX y monumentos de otras
 * ciudades y paises. Dos filtros la arreglan:
 *   - `filetype:bitmap` descarta los PDFs y DjVu, que eran casi todo el ruido.
 *   - `intitle:` exige que el termino este en el TITULO del archivo, no en la
 *     descripcion, que es de donde salian los falsos positivos.
 */
async function searchCommons(locality) {
  const primary = await runSearch(
    `intitle:"San Martin" intitle:${locality} filetype:bitmap`
  );
  if (primary.length) return primary;

  // Fallback igual de estricto en el titulo, por si la foto se llama solo
  // "Monumento a ..." sin nombrar al procer.
  return runSearch(`intitle:Monumento intitle:${locality} filetype:bitmap`);
}

async function main() {
  const { statues } = JSON.parse(await readFile(resolve(ROOT, 'data/statues.raw.json'), 'utf8'));

  /** @type {Record<string, any>} */
  const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, 'utf8')).points ?? {} : {};
  const pending = statues.filter((s) => !cache[s.osmId]);

  console.log(`${statues.length} estatuas | ${statues.length - pending.length} ya cacheadas | ${pending.length} por resolver`);
  if (pending.length === 0) console.log('Nada nuevo que buscar.');

  const tick = progress(pending.length, 'geocoding');
  let saveCounter = 0;

  for (const s of pending) {
    try {
      const place = await reverseGeocode(s);
      cache[s.osmId] = { ...s, ...place, candidates: [] };
      tick(place.locality ?? '(sin localidad)');
    } catch (err) {
      cache[s.osmId] = { ...s, locality: null, province: null, candidates: [], error: String(err.message) };
      tick('ERROR');
    }
    // Guardado incremental: si se corta la corrida no se pierde el avance.
    if (++saveCounter % 20 === 0) await persist(cache);
  }
  await persist(cache);

  // Nominatim devuelve nombres administrativos que no sirven para buscar
  // ("Municipio de Posadas", "Mercado de la Ciudad", "Pedania Los Reartes").
  // La localidad OSM mas cercana da el nombre real de la ciudad.
  const settlements = await loadSettlements(resolve(ROOT, 'data/settlements.json'));
  for (const p of Object.values(cache)) {
    const town = nearestSettlement({ lat: p.lat, lon: p.lon }, settlements);
    if (town) {
      p.town = town.name;
      p.population = town.population;
      p.place = town.place;
    }
    p.searchName = town?.name ?? p.locality;
  }

  // Buscar fotos una vez por localidad, no una por estatua: varias estatuas
  // comparten ciudad y la busqueda seria identica.
  const byLocality = new Map();
  for (const p of Object.values(cache)) {
    if (!p.searchName) continue;
    if (!byLocality.has(p.searchName)) byLocality.set(p.searchName, []);
    byLocality.get(p.searchName).push(p);
  }

  console.log(`\nBuscando fotos en Commons para ${byLocality.size} localidades...`);
  const tick2 = progress(byLocality.size, 'commons ');
  saveCounter = 0;

  for (const [locality, points] of byLocality) {
    try {
      const hits = await searchCommons(locality);
      for (const p of points) p.candidates = hits;
      tick2(`${locality} (${hits.length})`);
    } catch {
      tick2(`${locality} ERROR`);
    }
    if (++saveCounter % 20 === 0) await persist(cache);
  }
  await persist(cache);

  const withCands = Object.values(cache).filter((p) => p.candidates?.length).length;
  console.log(`\nEstatuas con al menos un candidato de foto: ${withCands}/${statues.length}`);
  console.log('Escrito data/candidates.json');
}

async function persist(points) {
  await writeFile(CACHE, JSON.stringify({ generatedAt: new Date().toISOString(), points }, null, 2));
}

main().catch((err) => {
  console.error('\nFallo:', err.message);
  process.exit(1);
});
