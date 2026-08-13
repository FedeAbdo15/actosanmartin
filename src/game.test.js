import { describe, it, expect } from 'vitest';
import { Game, MIN_ROUNDS, MAX_TEAMS } from './game.js';
import provincias from '../data/provincias.json';

/** Pool sintetico: 12 estatuas repartidas por el pais. */
const POOL = provincias.features.slice(0, 12).map((f, i) => ({
  id: `estatua-${i}`,
  name: `Estatua ${i}`,
  lat: f.properties.centroid.lat,
  lon: f.properties.centroid.lon,
  locality: `Localidad ${i}`,
  provinceIso: f.properties.iso,
  photo: `/photos/estatua-${i}.jpg`,
  hints: {},
}));

const prov = (iso) => {
  const f = provincias.features.find((x) => x.properties.iso === iso);
  return { iso, name: f.properties.name, centroid: f.properties.centroid };
};

/** Juega el torneo entero eligiendo siempre la misma provincia. */
function playAll(game, pick = () => prov('AR-C')) {
  const seen = [];
  while (game.phase !== 'standings') {
    expect(game.phase).toBe('turn');
    seen.push(game.currentRound);
    game.beginTurn();
    game.setGuess(pick(game));
    game.submitGuess();
    game.next();
  }
  return seen;
}

describe('armado del torneo', () => {
  it('arranca pidiendo el setup', () => {
    const game = new Game(POOL);
    expect(game.phase).toBe('setup');
  });

  it('los nombres se cargan todos juntos antes de la primera ronda', () => {
    const game = new Game(POOL);
    game.start(['Granaderos', 'Andes', 'Libertadores'], 2);

    expect(game.phase).toBe('turn');
    expect(game.teams.map((t) => t.name)).toEqual(['Granaderos', 'Andes', 'Libertadores']);
    expect(game.roundCount).toBe(2);
    expect(game.currentTeam.name).toBe('Granaderos');
  });

  it('el equipo sin nombre juega como "Equipo N"', () => {
    const game = new Game(POOL);
    game.start(['Granaderos', '  ', ''], 1);
    expect(game.teams.map((t) => t.name)).toEqual(['Granaderos', 'Equipo 2', 'Equipo 3']);
  });

  it('no arranca con menos de dos equipos', () => {
    const game = new Game(POOL);
    game.start(['Solos'], 1);
    expect(game.phase).toBe('setup');
  });

  it('el tope de rondas es el que entra sin repetir estatua', () => {
    const game = new Game(POOL); // 12 estatuas
    expect(game.maxRounds(4)).toBe(3);
    expect(game.maxRounds(5)).toBe(2);
    expect(game.maxRounds(6)).toBe(2);
  });

  it('no entran mas de 6 equipos', () => {
    const game = new Game(POOL);
    expect(game.maxTeams).toBe(MAX_TEAMS);

    game.start(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 1);
    expect(game.teamCount).toBe(MAX_TEAMS);
    expect(game.teams.map((t) => t.name)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('pedir mas rondas de las que entran las recorta al tope', () => {
    const game = new Game(POOL);
    game.start(['A', 'B', 'C', 'D'], 99);
    expect(game.roundCount).toBe(3);
  });

  it('pedir menos de una ronda igual juega una', () => {
    const game = new Game(POOL);
    game.start(['A', 'B'], 0);
    expect(game.roundCount).toBe(MIN_ROUNDS);
  });
});

describe('rondas como vueltas completas', () => {
  it('la vuelta pasa por todos los equipos antes de la siguiente', () => {
    const game = new Game(POOL);
    game.start(['A', 'B', 'C'], 2);

    const orden = [];
    while (game.phase !== 'standings') {
      orden.push(`${game.roundNumber}-${game.currentTeam.name}`);
      game.beginTurn();
      game.setGuess(prov('AR-C'));
      game.submitGuess();
      game.next();
    }

    expect(orden).toEqual(['1-A', '1-B', '1-C', '2-A', '2-B', '2-C']);
  });

  it('cada equipo termina con un resultado por ronda', () => {
    const game = new Game(POOL);
    game.start(['A', 'B', 'C'], 3);
    playAll(game);

    for (const team of game.teams) {
      expect(team.results.filter(Boolean)).toHaveLength(3);
    }
  });

  it('la tabla final llega recien despues de la ultima vuelta', () => {
    const game = new Game(POOL);
    game.start(['A', 'B'], 3);

    let turnos = 0;
    while (game.phase !== 'standings') {
      turnos++;
      game.beginTurn();
      game.setGuess(prov('AR-C'));
      game.submitGuess();
      game.next();
    }

    expect(turnos).toBe(6);
    expect(game.phase).toBe('standings');
  });
});

describe('no se repiten las fotos', () => {
  it('ninguna estatua sale dos veces en todo el torneo', () => {
    for (let intento = 0; intento < 30; intento++) {
      const game = new Game(POOL);
      game.start(['A', 'B', 'C', 'D'], 3); // 12 turnos, 12 estatuas
      const jugadas = playAll(game).map((r) => r.id);

      expect(jugadas).toHaveLength(12);
      expect(new Set(jugadas).size).toBe(12);
    }
  });

  it('tampoco se repiten cuando sobran estatuas', () => {
    const game = new Game(POOL);
    game.start(['A', 'B', 'C'], 2); // 6 turnos de 12 estatuas
    const jugadas = playAll(game).map((r) => r.id);
    expect(new Set(jugadas).size).toBe(6);
  });

  it('el reparto no depende del orden: el mazo se baraja', () => {
    const primeras = new Set();
    for (let i = 0; i < 40; i++) {
      const game = new Game(POOL);
      game.start(['A', 'B'], 1);
      primeras.add(game.currentRound.id);
    }
    expect(primeras.size).toBeGreaterThan(1);
  });
});

describe('tabla final', () => {
  it('suma los puntajes de todas las rondas', () => {
    const game = new Game(POOL);
    game.start(['A', 'B'], 2);
    playAll(game);

    for (const fila of game.standings) {
      const suma = fila.results.reduce((s, r) => s + r.score, 0);
      expect(fila.score).toBe(suma);
      expect(fila.results).toHaveLength(2);
    }
  });

  it('ordena de mayor a menor y comparte posicion en los empates', () => {
    const game = new Game(POOL);
    game.start(['A', 'B'], 2);
    // A acierta siempre, B tira todo a Tierra del Fuego.
    playAll(game, (g) => (g.currentTeam.name === 'A' ? prov(g.currentRound.provinceIso) : prov('AR-V')));

    const [primero, segundo] = game.standings;
    expect(primero.name).toBe('A');
    expect(primero.position).toBe(1);
    expect(primero.correct).toBe(2);
    expect(primero.score).toBeGreaterThan(segundo.score);
    expect(segundo.position).toBe(2);
  });

  it('cuenta los aciertos por equipo', () => {
    const game = new Game(POOL);
    game.start(['A', 'B'], 2);
    playAll(game, (g) => prov(g.currentRound.provinceIso));

    for (const fila of game.standings) {
      expect(fila.correct).toBe(2);
      expect(fila.position).toBe(1); // empatados en el maximo
    }
  });
});

describe('transiciones', () => {
  it('confirmar sin haber elegido provincia no hace nada', () => {
    const game = new Game(POOL);
    game.start(['A', 'B'], 1);
    game.beginTurn();
    game.submitGuess();
    expect(game.phase).toBe('playing');
  });

  it('las pistas se limpian entre turnos', () => {
    const game = new Game(POOL);
    game.start(['A', 'B'], 1);
    game.beginTurn();
    game.revealHint('region');
    expect(game.currentPenalty).toBeGreaterThan(0);

    game.setGuess(prov('AR-C'));
    game.submitGuess();
    game.next();
    expect(game.currentPenalty).toBe(0);
  });

  it('"nuevo torneo" vuelve al setup vacio', () => {
    const game = new Game(POOL);
    game.start(['A', 'B'], 1);
    playAll(game);
    game.backToSetup();

    expect(game.phase).toBe('setup');
    expect(game.teams).toHaveLength(0);
    expect(game.assignments).toHaveLength(0);
  });
});
