// Sistema de pistas.
//
// Existe por una limitacion real del contenido: muchas fotos son primeros
// planos de bustos, sin plaza ni cerros ni edificios visibles. Sin pistas esas
// rondas son inadivinables y el juego deja de ser un juego. El costo en puntos
// mantiene la tension: la pista te salva la ronda pero te cuesta el podio.

import provincias from '../data/provincias.json';

/** @typedef {{id:string, label:string, cost:number, get:(round:any)=>string|null}} Hint */

/** @type {Hint[]} */
export const HINTS = [
  {
    id: 'region',
    label: 'Región del país',
    cost: 300,
    get: (r) => r.hints?.region ?? null,
  },
  {
    id: 'population',
    label: 'Habitantes de la provincia',
    cost: 500,
    get: (r) => populationLabel(r.provinceIso),
  },
];

export const HINT_BY_ID = new Map(HINTS.map((h) => [h.id, h]));

/** Pistas que esta ronda puede ofrecer (las que tienen dato cargado). */
export function availableHints(round) {
  return HINTS.filter((h) => h.get(round));
}

/** Costo total de un conjunto de ids de pista ya revelados. */
export function totalPenalty(revealedIds) {
  let sum = 0;
  for (const id of revealedIds) sum += HINT_BY_ID.get(id)?.cost ?? 0;
  return sum;
}

/**
 * Poblacion de cada provincia, del censo 2022 via Wikidata. La carga
 * 4-fetch-provinces.mjs junto con la geometria.
 * @type {Map<string, number>}
 */
const POPULATION_BY_ISO = new Map(
  provincias.features
    .filter((f) => Number.isFinite(f.properties.population))
    .map((f) => [f.properties.iso, f.properties.population])
);

export function provincePopulation(iso) {
  return POPULATION_BY_ISO.get(iso) ?? null;
}

/**
 * La pista da un rango, no el numero exacto: "3.121.707 habitantes" se busca en
 * el celular y regala la respuesta, mientras que el rango deja cuatro o cinco
 * provincias posibles y obliga a pensar.
 */
export function populationLabel(iso) {
  const n = provincePopulation(iso);
  if (!n) return null;
  if (n >= 5_000_000) return 'Más de 5 millones de habitantes';
  if (n >= 2_000_000) return 'Entre 2 y 5 millones de habitantes';
  if (n >= 1_000_000) return 'Entre 1 y 2 millones de habitantes';
  if (n >= 500_000) return 'Entre 500.000 y 1 millón de habitantes';
  return 'Menos de 500.000 habitantes';
}
