// Sistema de pistas.
//
// Existe por una limitacion real del contenido: muchas fotos son primeros
// planos de bustos, sin plaza ni cerros ni edificios visibles. Sin pistas esas
// rondas son inadivinables y el juego deja de ser un juego. El costo en puntos
// mantiene la tension: la pista te salva la ronda pero te cuesta el podio.

/** @typedef {{id:string, label:string, cost:number, get:(round:any)=>string|null}} Hint */

/** @type {Hint[]} */
export const HINTS = [
  {
    id: 'kind',
    label: 'Tipo de monumento',
    cost: 200,
    get: (r) => r.hints?.kind ?? null,
  },
  {
    id: 'region',
    label: 'Region del pais',
    cost: 300,
    get: (r) => r.hints?.region ?? null,
  },
  {
    id: 'population',
    label: 'Tamano de la localidad',
    cost: 500,
    get: (r) => r.hints?.population ?? null,
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
 * Provincias agrupadas en regiones, para la pista "region".
 * Se resuelve en build (3-build-rounds.mjs) y se guarda en round.hints.region.
 */
export const REGION_BY_PROVINCE = {
  'Ciudad Autónoma de Buenos Aires': 'Centro / Pampeana',
  'Buenos Aires': 'Centro / Pampeana',
  'Córdoba': 'Centro / Pampeana',
  'Santa Fe': 'Centro / Pampeana',
  'Entre Ríos': 'Litoral / Mesopotamia',
  'Corrientes': 'Litoral / Mesopotamia',
  'Misiones': 'Litoral / Mesopotamia',
  'Chaco': 'Norte Grande',
  'Formosa': 'Norte Grande',
  'Santiago del Estero': 'Norte Grande',
  'Tucumán': 'Noroeste (NOA)',
  'Salta': 'Noroeste (NOA)',
  'Jujuy': 'Noroeste (NOA)',
  'Catamarca': 'Noroeste (NOA)',
  'La Rioja': 'Noroeste (NOA)',
  'Mendoza': 'Cuyo',
  'San Juan': 'Cuyo',
  'San Luis': 'Cuyo',
  // La Pampa entra en la Patagonia en la clasificacion turistica, pero como
  // pista de ubicacion eso desorienta: el norte provincial esta a la altura
  // de Buenos Aires. Se agrupa como pampeana.
  'La Pampa': 'Centro / Pampeana',
  'Neuquén': 'Patagonia',
  'Río Negro': 'Patagonia',
  'Chubut': 'Patagonia',
  'Santa Cruz': 'Patagonia',
  'Tierra del Fuego': 'Patagonia',
  'Tierra del Fuego, Antártida e Islas del Atlántico Sur': 'Patagonia',
};

export function regionFor(province) {
  if (!province) return null;
  if (REGION_BY_PROVINCE[province]) return REGION_BY_PROVINCE[province];
  // Nominatim devuelve variantes ("Provincia de Buenos Aires"): match laxo.
  const key = Object.keys(REGION_BY_PROVINCE).find(
    (p) => province.includes(p) || p.includes(province)
  );
  return key ? REGION_BY_PROVINCE[key] : null;
}
