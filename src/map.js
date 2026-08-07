// Todo lo que toca Leaflet vive aca.
//
// El mapa de eleccion no usa tiles: dibuja las 24 provincias desde un GeoJSON
// que viaja en el bundle (52 KB). O sea que funciona sin internet y sin API.
// El mapa de resultado si usa tiles de OpenStreetMap (sin key ni cuenta) para
// mostrar donde esta realmente la estatua.

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import provincias from '../data/provincias.json';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const ARGENTINA_BOUNDS = L.latLngBounds([-55.5, -74.5], [-21.0, -53.0]);

const COLORS = {
  idle: '#cfe2f0',
  hover: '#9ecbe8',
  selected: '#2f6fed',
  correct: '#2e9e5b',
  wrong: '#d64545',
  stroke: '#5b7285',
};

const STYLE_IDLE = { fillColor: COLORS.idle, fillOpacity: 0.85, color: COLORS.stroke, weight: 1 };
const STYLE_HOVER = { fillColor: COLORS.hover, fillOpacity: 0.95, color: COLORS.stroke, weight: 1.5 };
const STYLE_SELECTED = { fillColor: COLORS.selected, fillOpacity: 0.9, color: '#1b4bb0', weight: 2 };

/** Viaja en el bundle: no hay fetch ni espera. */
export const PROVINCES_GEOJSON = provincias;

const pinIcon = (color) =>
  L.divIcon({
    className: 'pin-icon',
    html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 41C15 41 28 24.5 28 14.5C28 7.04 22.18 1 15 1C7.82 1 2 7.04 2 14.5C2 24.5 15 41 15 41Z"
              fill="${color}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="15" cy="14.5" r="5" fill="#fff"/>
      </svg>`,
    iconSize: [30, 42],
    iconAnchor: [15, 41],
  });

/**
 * Mapa de provincias clickeable.
 * @param {HTMLElement} container
 * @param {(p:{iso:string,name:string,centroid:object})=>void} onPick
 */
export function createProvinceMap(container, onPick) {
  const map = L.map(container, {
    zoomControl: false,
    attributionControl: false,
    // Sin tiles no hay nada que "explorar": el zoom libre solo desorienta.
    scrollWheelZoom: false,
    doubleClickZoom: false,
    dragging: false,
    keyboard: false,
  });

  // La vista va ANTES de agregar capas. Un mapa sin centro ni zoom no tiene
  // bounds de renderer, y agregarle un poligono revienta en _clipPoints.
  map.fitBounds(ARGENTINA_BOUNDS);

  // El seleccionado puede ser un poligono o el circulo de CABA, que se pintan
  // distinto. Se guarda junto a como devolverlo a su estado normal.
  let selected = null;

  function select(target, restore, selectedStyle, province) {
    if (selected) selected.restore();
    selected = { setStyle: (s) => target.setStyle(s), restore };
    target.setStyle(selectedStyle);
    onPick(province);
  }

  const layer = L.geoJSON(PROVINCES_GEOJSON, {
    style: () => ({ ...STYLE_IDLE }),
    onEachFeature: (feature, lyr) => {
      const { name, iso, centroid } = feature.properties;
      const province = { iso, name, centroid };
      const restore = () => lyr.setStyle(STYLE_IDLE);

      lyr.bindTooltip(name, { sticky: true, direction: 'top' });

      lyr.on('mouseover', () => {
        if (selected?.restore !== restore) lyr.setStyle(STYLE_HOVER);
      });
      lyr.on('mouseout', () => {
        if (selected?.restore !== restore) lyr.setStyle(STYLE_IDLE);
      });
      lyr.on('click', () => {
        select(lyr, restore, STYLE_SELECTED, province);
        lyr.bringToFront();
      });
    },
  }).addTo(map);

  // CABA a escala nacional es un punto de pocos pixeles: como poligono es
  // inclickeable. Se le pone un circulo encima con su propia area de click.
  const caba = PROVINCES_GEOJSON.features.find((f) => f.properties.iso === 'AR-C');
  if (caba) {
    const { name, iso, centroid } = caba.properties;
    const DOT_IDLE = {
      radius: 6,
      fillColor: COLORS.idle,
      fillOpacity: 1,
      color: COLORS.stroke,
      weight: 1.5,
    };
    const dot = L.circleMarker([centroid.lat, centroid.lon], DOT_IDLE)
      .addTo(map)
      .bindTooltip(name, { direction: 'right' });

    const restore = () => dot.setStyle(DOT_IDLE);
    dot.on('mouseover', () => {
      if (selected?.restore !== restore) dot.setStyle({ fillColor: COLORS.hover });
    });
    dot.on('mouseout', () => {
      if (selected?.restore !== restore) restore();
    });
    dot.on('click', () =>
      select(
        dot,
        restore,
        { ...DOT_IDLE, radius: 7, fillColor: COLORS.selected, color: '#1b4bb0', weight: 2 },
        { iso, name, centroid }
      )
    );
  }

  const fit = () => map.fitBounds(layer.getBounds(), { padding: [4, 4] });
  fit();

  return {
    map,
    refresh() {
      map.invalidateSize();
      fit();
    },
  };
}

/**
 * Mapa de resultado: pinta la provincia correcta y la elegida, y marca el
 * punto exacto de la estatua sobre el mapa real.
 * @param {HTMLElement} container
 * @param {{lat:number, lon:number, provinceIso:string}} round
 * @param {string} guessedIso
 */
export function createRevealMap(container, round, guessedIso) {
  const map = L.map(container, { zoomControl: false, attributionControl: true });
  map.fitBounds(ARGENTINA_BOUNDS); // vista inicial antes de cualquier capa
  L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 18 }).addTo(map);

  const highlighted = PROVINCES_GEOJSON.features.filter((f) =>
    [round.provinceIso, guessedIso].includes(f.properties.iso)
  );

  const layer = L.geoJSON(
    { type: 'FeatureCollection', features: highlighted },
    {
      style: (feature) => ({
        fillColor:
          feature.properties.iso === round.provinceIso ? COLORS.correct : COLORS.wrong,
        fillOpacity: 0.3,
        color: feature.properties.iso === round.provinceIso ? COLORS.correct : COLORS.wrong,
        weight: 2,
      }),
    }
  ).addTo(map);

  L.marker([round.lat, round.lon], { icon: pinIcon(COLORS.correct) })
    .addTo(map)
    .bindTooltip('La estatua', { direction: 'top' });

  map.fitBounds(layer.getBounds(), { padding: [16, 16] });

  return {
    map,
    refresh() {
      map.invalidateSize();
      map.fitBounds(layer.getBounds(), { padding: [16, 16] });
    },
  };
}

export { ARGENTINA_BOUNDS };
