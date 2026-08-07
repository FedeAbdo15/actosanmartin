// Distancia y puntaje de una ronda.

const EARTH_RADIUS_KM = 6371;

/** Diagonal aproximada de Argentina continental (Jujuy -> Ushuaia). */
export const MAP_SIZE_KM = 3900;

export const MAX_SCORE = 5000;
export const ROUNDS_PER_GAME = 5;
export const MAX_GAME_SCORE = MAX_SCORE * ROUNDS_PER_GAME;

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Distancia great-circle en km entre dos puntos {lat, lon}.
 */
export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Puntaje por distancia, con la curva exponencial de GeoGuessr escalada a
 * Argentina. Referencias: 0 km -> 5000, 50 km -> ~4400, 200 km -> ~3000,
 * 1000 km -> ~385.
 */
export function scoreForDistance(km) {
  if (!Number.isFinite(km) || km < 0) return 0;
  return Math.round(MAX_SCORE * Math.exp((-10 * km) / MAP_SIZE_KM));
}

/**
 * Aplica el costo de las pistas usadas. Nunca baja de 0.
 * @param {number} score
 * @param {number} penalty suma de costos de las pistas reveladas
 */
export function applyHintPenalty(score, penalty) {
  return Math.max(0, score - penalty);
}

/**
 * Techo de puntaje cuando la provincia elegida no es la correcta.
 * Acertar tiene que valer claramente mas que quedar cerca, si no elegir la
 * provincia vecina grande seria una estrategia razonable.
 */
export const MAX_WRONG_PROVINCE_SCORE = 2500;

/**
 * Resultado de una ronda: se eligio una provincia.
 *
 * Acertar da el maximo. Errar da puntaje parcial segun cuan lejos quedo el
 * centro de la provincia elegida de la estatua real, con la misma curva que
 * usa la distancia. Asi confundir Rio Negro con Neuquen duele mucho menos que
 * mandar la estatua de Ushuaia a Jujuy.
 *
 * @param {{iso:string, centroid:{lat:number,lon:number}}} guess provincia elegida
 * @param {{lat:number, lon:number, provinceIso:string}} round
 * @param {number} hintPenalty
 */
export function evaluateProvinceGuess(guess, round, hintPenalty = 0) {
  const correct = guess.iso === round.provinceIso;
  const distanceKm = haversine(guess.centroid, { lat: round.lat, lon: round.lon });

  const base = correct
    ? MAX_SCORE
    : Math.min(MAX_WRONG_PROVINCE_SCORE, scoreForDistance(distanceKm));

  return {
    correct,
    guessedIso: guess.iso,
    distanceKm,
    baseScore: base,
    hintPenalty,
    score: applyHintPenalty(base, hintPenalty),
  };
}
