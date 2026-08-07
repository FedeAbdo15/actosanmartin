import { describe, it, expect } from 'vitest';
import {
  haversine,
  scoreForDistance,
  applyHintPenalty,
  evaluateProvinceGuess,
  MAX_SCORE,
  MAX_WRONG_PROVINCE_SCORE,
} from './scoring.js';
import { isoForProvince, provinceName, provinceList } from './provinces.js';
import provincias from '../data/provincias.json';

const CABA = { lat: -34.6037, lon: -58.3816 };
const MENDOZA = { lat: -32.8895, lon: -68.8458 };
const USHUAIA = { lat: -54.8019, lon: -68.303 };

describe('haversine', () => {
  it('da 0 para el mismo punto', () => {
    expect(haversine(CABA, CABA)).toBe(0);
  });

  it('CABA - Mendoza ~985 km', () => {
    expect(haversine(CABA, MENDOZA)).toBeGreaterThan(960);
    expect(haversine(CABA, MENDOZA)).toBeLessThan(1010);
  });

  it('CABA - Ushuaia ~2380 km', () => {
    expect(haversine(CABA, USHUAIA)).toBeGreaterThan(2330);
    expect(haversine(CABA, USHUAIA)).toBeLessThan(2430);
  });

  it('es simetrica', () => {
    expect(haversine(CABA, USHUAIA)).toBeCloseTo(haversine(USHUAIA, CABA), 6);
  });
});

describe('scoreForDistance', () => {
  it('da el maximo en distancia 0', () => {
    expect(scoreForDistance(0)).toBe(MAX_SCORE);
  });

  it('es monotona decreciente', () => {
    const kms = [0, 10, 50, 100, 200, 500, 1000, 2000, 4000];
    const scores = kms.map(scoreForDistance);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]);
    }
  });

  it('respeta los puntos de referencia de la curva', () => {
    expect(scoreForDistance(50)).toBeGreaterThan(4300);
    expect(scoreForDistance(50)).toBeLessThan(4500);
    expect(scoreForDistance(200)).toBeGreaterThan(2900);
    expect(scoreForDistance(200)).toBeLessThan(3100);
    expect(scoreForDistance(1000)).toBeLessThan(500);
  });

  it('nunca es negativa ni supera el maximo', () => {
    for (const km of [0, 1, 100, 5000, 20000]) {
      const s = scoreForDistance(km);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(MAX_SCORE);
    }
  });

  it('trata entradas invalidas como 0', () => {
    expect(scoreForDistance(NaN)).toBe(0);
    expect(scoreForDistance(-5)).toBe(0);
  });
});

describe('applyHintPenalty', () => {
  it('resta el costo', () => {
    expect(applyHintPenalty(5000, 500)).toBe(4500);
  });

  it('no baja de 0', () => {
    expect(applyHintPenalty(200, 1000)).toBe(0);
  });
});

const prov = (iso) => {
  const f = provincias.features.find((x) => x.properties.iso === iso);
  return { iso, name: f.properties.name, centroid: f.properties.centroid };
};

// Estatua de Cachi, Salta.
const RONDA_SALTA = { lat: -25.12, lon: -66.162, provinceIso: 'AR-A' };

describe('evaluateProvinceGuess', () => {
  it('acertar la provincia da el maximo', () => {
    const r = evaluateProvinceGuess(prov('AR-A'), RONDA_SALTA, 0);
    expect(r.correct).toBe(true);
    expect(r.score).toBe(MAX_SCORE);
  });

  it('errar nunca alcanza el puntaje de acertar', () => {
    for (const { iso } of provinceList()) {
      if (iso === RONDA_SALTA.provinceIso) continue;
      const r = evaluateProvinceGuess(prov(iso), RONDA_SALTA, 0);
      expect(r.correct).toBe(false);
      expect(r.score).toBeLessThanOrEqual(MAX_WRONG_PROVINCE_SCORE);
      expect(r.score).toBeLessThan(MAX_SCORE);
    }
  });

  it('una provincia vecina puntua mas que una lejana', () => {
    const jujuy = evaluateProvinceGuess(prov('AR-Y'), RONDA_SALTA, 0);
    const tdf = evaluateProvinceGuess(prov('AR-V'), RONDA_SALTA, 0);
    expect(jujuy.score).toBeGreaterThan(tdf.score);
  });

  it('descuenta las pistas del puntaje base', () => {
    const r = evaluateProvinceGuess(prov('AR-A'), RONDA_SALTA, 300);
    expect(r.baseScore).toBe(MAX_SCORE);
    expect(r.score).toBe(MAX_SCORE - 300);
  });

  it('el descuento no deja el puntaje en negativo', () => {
    const r = evaluateProvinceGuess(prov('AR-V'), RONDA_SALTA, 5000);
    expect(r.score).toBe(0);
  });
});

describe('provinces', () => {
  it('el GeoJSON trae las 24 jurisdicciones', () => {
    expect(provincias.features).toHaveLength(24);
  });

  it('cada feature del GeoJSON matchea un ISO conocido', () => {
    for (const f of provincias.features) {
      expect(provinceName(f.properties.iso)).toBe(f.properties.name);
    }
  });

  it('resuelve las variantes de nombre de Nominatim', () => {
    expect(isoForProvince('Ciudad Autónoma de Buenos Aires')).toBe('AR-C');
    expect(isoForProvince('Provincia de Misiones')).toBe('AR-N');
    expect(isoForProvince('Neuquén')).toBe('AR-Q');
    expect(isoForProvince('Tierra del Fuego, Antártida e Islas del Atlántico Sur')).toBe('AR-V');
  });

  it('devuelve null si no reconoce la provincia', () => {
    expect(isoForProvince('Montevideo')).toBeNull();
    expect(isoForProvince('')).toBeNull();
  });
});

