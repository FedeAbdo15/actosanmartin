// Paso 3: convierte candidatos en rondas jugables.
//
//   node scripts/3-build-rounds.mjs --propose   ->  data/curation.json (borrador)
//   node scripts/3-build-rounds.mjs             ->  data/rounds.json + public/photos/
//
// La curacion NO es automatica: --propose puntua los candidatos y arma un
// borrador, pero cada entrada tiene que quedar con "approved": true a mano.
// La busqueda por texto de Commons trae ruido comprobado (aparecieron "Teatro
// del Libertador General San Martin" y "Plaza Primera Junta (La Plata ca 1900)"
// como primeros resultados), asi que aprobar a ciegas mete rondas rotas.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getJson, get, throttle, progress } from './lib/http.mjs';
import { loadSettlements, nearestSettlement, populationBucket } from './lib/settlements.mjs';
import { regionFor } from '../src/hints.js';
import { isoForProvince, provinceName } from '../src/provinces.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const wait = throttle(1);

// --- Heuristica de puntuacion de candidatos -------------------------------

// Palabras que indican que el archivo SI es la estatua que buscamos.
const GOOD = /monumento|estatua|busto|escultura|monument|statue/i;
// Palabras que indican que NO lo es: edificios, instituciones, mapas, banderas.
const BAD =
  /teatro|estaci[oó]n|escuela|colegio|hospital|club|iglesia|catedral|museo|mapa|escudo|bandera|logo|billete|sello|moneda|retrato|pintura|libro|placa|calle|avenida|ruta|puente|aeropuerto|cancha|estadio/i;
// Otros paises: Commons mezcla San Martin de Lima, Santiago, Nueva York, etc.
const FOREIGN =
  /lima|per[uú]|santiago|chile|montevideo|uruguay|new york|nueva york|washington|london|londres|madrid|sevilla|barcelona|vigo|coru[nñ]a|paris|viena|vienna|berlin|yerevan|israel|boulogne|brunoy/i;

/** Minusculas sin acentos, para comparar "Neuquén" con "Neuquen". */
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Devuelve null si el candidato NO sirve, o un puntaje si es plausible.
 *
 * Los dos requisitos duros salieron de revisar la primera tanda: sin ellos
 * entraban monumentos de Ciudad de Mexico, de Goya asignados a Corrientes
 * capital, y de Villa Mercedes (San Luis) asignados a Mercedes (Buenos Aires).
 */
function scoreCandidate(title, locality) {
  const t = norm(title);
  const loc = norm(locality);

  if (BAD.test(title) || FOREIGN.test(title)) return null;

  // Requisito 1: la ciudad tiene que estar nombrada en el titulo.
  if (!loc || !t.includes(loc)) return null;

  // Requisito 2: tiene que hablar del procer o de un monumento.
  const aboutSanMartin = /san\s*mart|libertador/.test(t);
  if (!aboutSanMartin && !GOOD.test(title)) return null;

  let score = 0;
  if (GOOD.test(title)) score += 3;
  if (aboutSanMartin) score += 3;
  // Una foto de "Plaza San Martin" suele ser la plaza con el monumento al
  // centro: buen encuadre abierto, que es justo lo que sirve para jugar.
  if (/plaza/.test(t)) score += 1;
  return score;
}

// --- Modo --propose --------------------------------------------------------

async function propose() {
  const { points } = JSON.parse(await readFile(resolve(ROOT, 'data/candidates.json'), 'utf8'));
  const settlements = await loadSettlements(resolve(ROOT, 'data/settlements.json'));

  const entries = [];
  const seenLocality = new Set();
  // Un mismo archivo no puede ser la foto de dos ciudades distintas. En la
  // primera tanda, un unico documento historico aparecio como "candidato" de
  // diez localidades a la vez.
  const usedFiles = new Set();

  for (const p of Object.values(points)) {
    if (!p.candidates?.length) continue;

    const town = nearestSettlement({ lat: p.lat, lon: p.lon }, settlements);
    const locality = town?.name ?? p.locality;
    if (!locality) continue;

    // Una ronda por localidad: dos bustos de la misma ciudad serian la misma
    // respuesta en el mapa y arruinan la partida.
    if (seenLocality.has(locality)) continue;

    const ranked = p.candidates
      .map((c) => ({ ...c, score: scoreCandidate(c.title, locality) }))
      .filter((c) => c.score !== null && !usedFiles.has(c.title))
      .sort((a, b) => b.score - a.score);

    if (!ranked.length) continue;

    seenLocality.add(locality);
    usedFiles.add(ranked[0].title);
    entries.push({
      osmId: p.osmId,
      name: p.name,
      locality,
      province: p.province,
      lat: p.lat,
      lon: p.lon,
      kind: p.kind,
      population: town?.population ?? null,
      place: town?.place ?? null,
      approved: null, // <-- poner true a mano tras mirar la foto
      file: ranked[0].title,
      alternatives: ranked.slice(1, 4).map((c) => `${c.title} (${c.score})`),
      topScore: ranked[0].score,
    });
  }

  entries.sort((a, b) => b.topScore - a.topScore);

  await writeFile(resolve(ROOT, 'data/curation.json'), JSON.stringify(entries, null, 2));
  console.log(`Borrador con ${entries.length} candidatos en data/curation.json`);
  console.log('Revisa cada uno y pone "approved": true en los que sirvan.');
  console.log(`Provincias representadas: ${new Set(entries.map((e) => e.province)).size}`);
}

// --- Modo build ------------------------------------------------------------

async function fetchImageInfo(file) {
  const url =
    `${COMMONS}?action=query&titles=${encodeURIComponent('File:' + file)}` +
    `&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1600&format=json`;
  await wait();
  const j = await getJson(url);
  const page = Object.values(j.query?.pages ?? {})[0];
  return page?.imageinfo?.[0] ?? null;
}

const stripHtml = (s) => String(s ?? '').replace(/<[^>]+>/g, '').trim();

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

async function build() {
  const curationPath = resolve(ROOT, 'data/curation.json');
  if (!existsSync(curationPath)) {
    console.error('Falta data/curation.json. Corre primero: node scripts/3-build-rounds.mjs --propose');
    process.exit(1);
  }

  const curation = JSON.parse(await readFile(curationPath, 'utf8'));
  const approved = curation.filter((e) => e.approved === true);

  console.log(`${curation.length} candidatos | ${approved.length} aprobados`);
  if (approved.length === 0) {
    console.error('No hay nada aprobado todavia: edita data/curation.json y pone "approved": true.');
    process.exit(1);
  }

  const photoDir = resolve(ROOT, 'public/photos');
  await mkdir(photoDir, { recursive: true });

  const rounds = [];
  const tick = progress(approved.length, 'fotos');

  for (const entry of approved) {
    try {
      const info = await fetchImageInfo(entry.file);
      if (!info) {
        tick(`${entry.locality} SIN INFO`);
        continue;
      }

      const ext = (info.thumburl.match(/\.(jpe?g|png)$/i)?.[1] ?? 'jpg').toLowerCase();
      const id = slug(`${entry.locality}-${entry.osmId.replace('/', '-')}`);
      const filename = `${id}.${ext}`;

      const res = await get(info.thumburl, { timeoutMs: 90_000 });
      await writeFile(resolve(photoDir, filename), Buffer.from(await res.arrayBuffer()));

      // La provincia es la respuesta del juego: si el nombre de Nominatim no
      // resuelve a un codigo ISO, la ronda seria injugable. Mejor cortar aca
      // que descubrirlo jugando.
      const provinceIso = isoForProvince(entry.province);
      if (!provinceIso) {
        throw new Error(`provincia no reconocida: "${entry.province}"`);
      }

      const em = info.extmetadata ?? {};
      rounds.push({
        id,
        name: entry.name,
        lat: entry.lat,
        lon: entry.lon,
        locality: entry.locality,
        province: provinceName(provinceIso),
        provinceIso,
        photo: `/photos/${filename}`,
        hints: {
          kind: kindLabel(entry.kind),
          region: regionFor(entry.province),
          population: populationBucket(entry.population, entry.place),
        },
        attribution: {
          artist: stripHtml(em.Artist?.value) || null,
          license: stripHtml(em.LicenseShortName?.value) || 'Ver en Commons',
          credit: stripHtml(em.Credit?.value) || null,
          commonsUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(entry.file.replace(/ /g, '_'))}`,
        },
      });
      tick(entry.locality);
    } catch (err) {
      tick(`${entry.locality} ERROR`);
      console.warn(`\n  fallo ${entry.locality}: ${err.message}`);
    }
  }

  await writeFile(resolve(ROOT, 'data/rounds.json'), JSON.stringify(rounds, null, 2));
  console.log(`\n${rounds.length} rondas escritas en data/rounds.json`);
  console.log(`Provincias: ${new Set(rounds.map((r) => r.province)).size}`);
}

function kindLabel(kind) {
  return (
    {
      bust: 'Busto',
      statue: 'Estatua',
      sculpture: 'Escultura',
      monument: 'Monumento',
      memorial: 'Memorial',
      person: 'Estatua de cuerpo entero',
    }[kind] ?? 'Monumento'
  );
}

const mode = process.argv.includes('--propose') ? propose : build;
mode().catch((err) => {
  console.error('\nFallo:', err.message);
  process.exit(1);
});
