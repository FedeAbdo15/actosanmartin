// Valida data/rounds.json antes de dar el juego por bueno.
//
//   node scripts/validate-rounds.mjs
//
// Sale con codigo != 0 si algo falta, para poder usarlo en CI.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PROVINCES } from '../src/provinces.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Bounding box de Argentina con un margen chico.
const BBOX = { latMin: -55.2, latMax: -21.5, lonMin: -74.0, lonMax: -53.4 };

const errors = [];
const warnings = [];

function check(cond, msg) {
  if (!cond) errors.push(msg);
}

async function main() {
  const path = resolve(ROOT, 'data/rounds.json');
  if (!existsSync(path)) {
    console.error('No existe data/rounds.json. Corre: npm run data:rounds');
    process.exit(1);
  }

  const rounds = JSON.parse(await readFile(path, 'utf8'));
  check(Array.isArray(rounds), 'rounds.json debe ser un array');
  check(rounds.length >= 5, `Hacen falta al menos 5 rondas para jugar (hay ${rounds.length})`);

  const ids = new Set();
  const provinces = new Set();

  for (const [i, r] of rounds.entries()) {
    const at = `ronda[${i}] ${r.id ?? '(sin id)'}`;

    check(r.id, `${at}: falta id`);
    check(!ids.has(r.id), `${at}: id duplicado`);
    ids.add(r.id);

    check(r.name, `${at}: falta name`);

    check(
      Number.isFinite(r.lat) && r.lat >= BBOX.latMin && r.lat <= BBOX.latMax,
      `${at}: lat ${r.lat} fuera de Argentina`
    );
    check(
      Number.isFinite(r.lon) && r.lon >= BBOX.lonMin && r.lon <= BBOX.lonMax,
      `${at}: lon ${r.lon} fuera de Argentina`
    );

    // La foto tiene que existir en disco: si no, la ronda se ve rota.
    check(r.photo, `${at}: falta photo`);
    if (r.photo) {
      const file = resolve(ROOT, 'public', r.photo.replace(/^\//, ''));
      check(existsSync(file), `${at}: no existe el archivo ${r.photo}`);
    }

    // Atribucion: requisito legal de las licencias CC de Commons.
    // provinceIso es la respuesta correcta de la ronda: sin el, no hay juego.
    check(r.provinceIso, `${at}: falta provinceIso`);
    check(
      !r.provinceIso || PROVINCES[r.provinceIso],
      `${at}: provinceIso "${r.provinceIso}" no es una jurisdiccion argentina`
    );

    check(r.attribution?.license, `${at}: falta attribution.license`);
    check(r.attribution?.commonsUrl, `${at}: falta attribution.commonsUrl`);
    if (r.attribution?.license && !/public domain|cc0/i.test(r.attribution.license)) {
      check(r.attribution?.artist, `${at}: licencia ${r.attribution.license} exige artist`);
    }

    if (r.province) provinces.add(r.province);
    if (!r.hints || Object.values(r.hints).filter(Boolean).length === 0) {
      warnings.push(`${at}: sin pistas cargadas (la ronda puede ser inadivinable)`);
    }
  }

  console.log(`Rondas: ${rounds.length}`);
  console.log(`Provincias cubiertas: ${provinces.size}`);
  console.log(`  ${[...provinces].sort().join(', ')}`);

  if (provinces.size < 12) {
    warnings.push(`Solo ${provinces.size} provincias cubiertas; la meta del plan son 12+`);
  }

  for (const w of warnings) console.warn(`AVISO  ${w}`);
  for (const e of errors) console.error(`ERROR  ${e}`);

  if (errors.length) {
    console.error(`\n${errors.length} error(es). rounds.json NO es valido.`);
    process.exit(1);
  }
  console.log(`\nrounds.json valido${warnings.length ? ` (con ${warnings.length} aviso/s)` : ''}.`);
}

main().catch((err) => {
  console.error('Fallo:', err.message);
  process.exit(1);
});
