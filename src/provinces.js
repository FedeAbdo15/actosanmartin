// Las 24 jurisdicciones argentinas y como resolver el nombre que devuelve
// Nominatim al codigo ISO que usa el juego.

/** Codigos ISO 3166-2:AR -> nombre canonico (el mismo que trae el GeoJSON). */
export const PROVINCES = {
  'AR-A': 'Salta',
  'AR-B': 'Buenos Aires',
  'AR-C': 'Ciudad de Buenos Aires',
  'AR-D': 'San Luis',
  'AR-E': 'Entre Ríos',
  'AR-F': 'La Rioja',
  'AR-G': 'Santiago del Estero',
  'AR-H': 'Chaco',
  'AR-J': 'San Juan',
  'AR-K': 'Catamarca',
  'AR-L': 'La Pampa',
  'AR-M': 'Mendoza',
  'AR-N': 'Misiones',
  'AR-P': 'Formosa',
  'AR-Q': 'Neuquén',
  'AR-R': 'Río Negro',
  'AR-S': 'Santa Fe',
  'AR-T': 'Tucumán',
  'AR-U': 'Chubut',
  'AR-V': 'Tierra del Fuego',
  'AR-W': 'Corrientes',
  'AR-X': 'Córdoba',
  'AR-Y': 'Jujuy',
  'AR-Z': 'Santa Cruz',
};

const normalize = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^provincia (de|del) /, '')
    .trim();

// Variantes reales que devolvio Nominatim y que no matchean el nombre canonico.
const ALIASES = {
  'ciudad autonoma de buenos aires': 'AR-C',
  caba: 'AR-C',
  'capital federal': 'AR-C',
  'tierra del fuego, antartida e islas del atlantico sur': 'AR-V',
  'tierra del fuego, antartida e islas del atlantico sud': 'AR-V',
};

const BY_NAME = new Map(
  Object.entries(PROVINCES).map(([iso, name]) => [normalize(name), iso])
);

/**
 * Nombre de provincia (en cualquiera de sus variantes) -> codigo ISO.
 * @returns {string|null}
 */
export function isoForProvince(name) {
  const key = normalize(name);
  return ALIASES[key] ?? BY_NAME.get(key) ?? null;
}

export function provinceName(iso) {
  return PROVINCES[iso] ?? iso;
}

/** Lista ordenada alfabeticamente, para menus y listados. */
export function provinceList() {
  return Object.entries(PROVINCES)
    .map(([iso, name]) => ({ iso, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
