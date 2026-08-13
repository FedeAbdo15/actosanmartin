import { describe, it, expect } from 'vitest';
import {
  HINTS,
  availableHints,
  totalPenalty,
  populationLabel,
  provincePopulation,
} from './hints.js';
import { regionFor } from './regions.js';
import { provinceList } from './provinces.js';
import provincias from '../data/provincias.json';
import rounds from '../data/rounds.json';

const RONDA = { provinceIso: 'AR-A', hints: { region: 'Noroeste (NOA)' } };

describe('catalogo de pistas', () => {
  it('son dos: region y habitantes de la provincia', () => {
    expect(HINTS.map((h) => h.id)).toEqual(['region', 'population']);
  });

  it('el maximo que se puede perder por pistas son 800 puntos', () => {
    expect(totalPenalty(HINTS.map((h) => h.id))).toBe(800);
  });

  it('ignora los ids que no existen', () => {
    expect(totalPenalty(['kind', 'population'])).toBe(500);
  });

  it('todas las rondas del juego ofrecen las dos pistas', () => {
    for (const round of rounds) {
      expect(availableHints(round).map((h) => h.id)).toEqual(['region', 'population']);
    }
  });
});

describe('habitantes de la provincia', () => {
  it('las 24 jurisdicciones tienen poblacion cargada', () => {
    for (const { iso, name } of provinceList()) {
      expect(provincePopulation(iso), name).toBeGreaterThan(0);
    }
  });

  it('agrupa en rangos, sin dar el numero exacto', () => {
    const label = populationLabel('AR-C'); // CABA, 3,1 millones
    expect(label).toBe('Entre 2 y 5 millones de habitantes');
    expect(label).not.toMatch(/\d{6}/);
  });

  it('Buenos Aires es la unica del rango mas alto', () => {
    const top = provinceList().filter(
      ({ iso }) => populationLabel(iso) === 'Más de 5 millones de habitantes'
    );
    expect(top.map((p) => p.name)).toEqual(['Buenos Aires']);
  });

  it('provincias mas pobladas nunca caen en un rango mas bajo', () => {
    const orden = [
      'Menos de 500.000 habitantes',
      'Entre 500.000 y 1 millón de habitantes',
      'Entre 1 y 2 millones de habitantes',
      'Entre 2 y 5 millones de habitantes',
      'Más de 5 millones de habitantes',
    ];
    const rango = (iso) => orden.indexOf(populationLabel(iso));

    const porPoblacion = provincias.features
      .map((f) => f.properties)
      .sort((a, b) => a.population - b.population);

    for (let i = 1; i < porPoblacion.length; i++) {
      expect(rango(porPoblacion[i].iso)).toBeGreaterThanOrEqual(rango(porPoblacion[i - 1].iso));
    }
  });

  it('devuelve null para una provincia desconocida', () => {
    expect(populationLabel('AR-ZZ')).toBeNull();
    expect(provincePopulation('AR-ZZ')).toBeNull();
  });
});

describe('region del pais', () => {
  it('la pista sale de la ronda', () => {
    expect(HINTS[0].get(RONDA)).toBe('Noroeste (NOA)');
  });

  it('cada jurisdiccion tiene region', () => {
    for (const { name } of provinceList()) {
      expect(regionFor(name), name).toBeTruthy();
    }
  });

  it('resuelve las variantes de nombre de Nominatim', () => {
    expect(regionFor('Provincia de Buenos Aires')).toBe('Centro / Pampeana');
    expect(regionFor('Tierra del Fuego, Antártida e Islas del Atlántico Sur')).toBe('Patagonia');
    expect(regionFor('')).toBeNull();
  });
});
