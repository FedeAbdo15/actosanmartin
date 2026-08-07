// Paso 4: geometria de las 24 provincias argentinas, para el mapa de eleccion.
//
//   node scripts/4-fetch-provinces.mjs   ->   data/provincias.json
//
// Baja Natural Earth admin-1 (40 MB, dominio publico), se queda con Argentina y
// simplifica los contornos. Sin simplificar el archivo pesa ~3 MB y no vale la
// pena: a la escala del pais no se nota la diferencia.

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { get } from './lib/http.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, 'data/.ne-admin1.json');

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';

/** Tolerancia de simplificacion en grados (~2 km). */
const TOLERANCE = 0.02;

// --- Douglas-Peucker -------------------------------------------------------

function perpendicularDistance([px, py], [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + clamped * dx), py - (y1 + clamped * dy));
}

function simplifyRing(points, tolerance) {
  if (points.length <= 4) return points;

  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist <= tolerance) return [points[0], points[points.length - 1]];

  const left = simplifyRing(points.slice(0, index + 1), tolerance);
  const right = simplifyRing(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/** Un anillo cerrado necesita al menos 4 puntos para seguir siendo un poligono. */
function simplifyPolygon(rings, tolerance) {
  return rings
    .map((ring) => {
      const simplified = simplifyRing(ring, tolerance).map(([x, y]) => [
        Number(x.toFixed(3)),
        Number(y.toFixed(3)),
      ]);
      // Reasegurar el cierre: el redondeo puede separar primer y ultimo punto.
      const first = simplified[0];
      const last = simplified[simplified.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) simplified.push([...first]);
      return simplified;
    })
    .filter((ring) => ring.length >= 4);
}

function simplifyGeometry(geometry, tolerance) {
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: simplifyPolygon(geometry.coordinates, tolerance) };
  }
  return {
    type: 'MultiPolygon',
    coordinates: geometry.coordinates
      .map((poly) => simplifyPolygon(poly, tolerance))
      .filter((poly) => poly.length > 0),
  };
}

// --- Centroide -------------------------------------------------------------

/** Centroide del anillo exterior mas grande: alcanza para puntuar cercania. */
function representativePoint(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

  let best = null;
  let bestArea = -1;
  for (const poly of polys) {
    const ring = poly[0];
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    }
    area = Math.abs(area / 2);
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }

  let x = 0;
  let y = 0;
  for (const [lon, lat] of best) {
    x += lon;
    y += lat;
  }
  return { lon: Number((x / best.length).toFixed(4)), lat: Number((y / best.length).toFixed(4)) };
}

// --- Main ------------------------------------------------------------------

async function main() {
  let raw;
  if (existsSync(CACHE)) {
    console.log('Usando Natural Earth cacheado...');
    raw = JSON.parse(await readFile(CACHE, 'utf8'));
  } else {
    console.log('Bajando Natural Earth admin-1 (~40 MB, una sola vez)...');
    const res = await get(SOURCE, { timeoutMs: 300_000 });
    raw = await res.json();
    await mkdir(resolve(ROOT, 'data'), { recursive: true });
    await writeFile(CACHE, JSON.stringify(raw));
  }

  const argentina = raw.features.filter((f) => f.properties?.adm0_a3 === 'ARG');
  console.log(`  jurisdicciones argentinas: ${argentina.length}`);

  const features = argentina
    .map((f) => {
      const geometry = simplifyGeometry(f.geometry, TOLERANCE);
      return {
        type: 'Feature',
        properties: {
          name: f.properties.name,
          iso: f.properties.iso_3166_2,
          centroid: representativePoint(f.geometry),
        },
        geometry,
      };
    })
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'es'));

  const out = { type: 'FeatureCollection', features };
  const json = JSON.stringify(out);

  await writeFile(resolve(ROOT, 'data/provincias.json'), json);

  const before = JSON.stringify({ type: 'FeatureCollection', features: argentina }).length;
  console.log(`  simplificado: ${(before / 1e6).toFixed(1)} MB -> ${(json.length / 1024).toFixed(0)} KB`);
  console.log('Escrito data/provincias.json');
}

main().catch((err) => {
  console.error('\nFallo:', err.message);
  process.exit(1);
});
