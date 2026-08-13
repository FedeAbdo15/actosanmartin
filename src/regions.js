// Provincias agrupadas en regiones, para la pista "region del pais".
//
// Vive fuera de hints.js porque lo usa tambien el pipeline de datos
// (3-build-rounds.mjs), que corre en Node pelado: hints.js importa el GeoJSON
// de provincias y eso solo lo resuelve el bundler.

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
