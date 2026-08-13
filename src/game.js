// Maquina de estados del torneo. No toca el DOM: la UI se suscribe.
//
// Formato: primero se cargan los nombres de todos los equipos y cuantas rondas
// se juegan. Cada ronda es una vuelta completa: juegan todos los equipos, uno
// por turno, y despues arranca la vuelta siguiente. Ninguna estatua se repite
// en todo el torneo: el mazo se reparte entero al empezar. Los puntajes recien
// se muestran juntos, en la tabla final.

import { evaluateProvinceGuess, MAX_SCORE } from './scoring.js';
import { totalPenalty } from './hints.js';

const BEST_SCORE_KEY = 'geosanmartin.bestScore';

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 6;
export const DEFAULT_TEAMS = 4;

export const MIN_ROUNDS = 1;
export const DEFAULT_ROUNDS = 3;

/** @typedef {'setup'|'turn'|'playing'|'revealed'|'standings'} Phase */
/** @typedef {{name:string, results:Array<object|null>}} Team */

export class Game {
  /** @param {Array<object>} pool rondas disponibles (rounds.json) */
  constructor(pool) {
    if (!Array.isArray(pool) || pool.length === 0) {
      throw new Error('El pool de rondas esta vacio.');
    }
    this.pool = pool;
    /** @type {Set<(g:Game)=>void>} */
    this.listeners = new Set();
    this.reset();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  #emit() {
    for (const fn of this.listeners) fn(this);
  }

  reset() {
    /** @type {Phase} */
    this.phase = 'setup';
    /** @type {Array<Team>} */
    this.teams = [];
    this.roundCount = 0;
    /** Vuelta en juego, base 0. */
    this.roundIndex = 0;
    /** Equipo al que le toca dentro de la vuelta, base 0. */
    this.teamIndex = 0;
    /** Reparto del torneo entero: assignments[ronda][equipo] = estatua. */
    this.assignments = [];
    this.guess = null;
    /** @type {Set<string>} */
    this.revealedHints = new Set();
    this.isNewBest = false;
  }

  /** Tope de equipos que banca el pool: nadie puede jugar sin estatua propia. */
  get maxTeams() {
    return Math.min(MAX_TEAMS, this.pool.length);
  }

  /**
   * Vueltas que se pueden jugar sin repetir ninguna estatua.
   * @param {number} teamCount
   */
  maxRounds(teamCount) {
    const teams = clamp(Math.round(Number(teamCount) || 0), MIN_TEAMS, this.maxTeams);
    return Math.max(MIN_ROUNDS, Math.floor(this.pool.length / teams));
  }

  /**
   * Arranca el torneo con los equipos ya bautizados y reparte las estatuas.
   * @param {Array<string>} names
   * @param {number} rounds cuantas vueltas juega cada equipo
   */
  start(names, rounds) {
    const clean = (Array.isArray(names) ? names : [])
      .slice(0, this.maxTeams)
      .map((n) => String(n ?? '').trim());
    if (clean.length < MIN_TEAMS) return;

    this.reset();
    this.teams = clean.map((name, i) => ({
      name: name || `Equipo ${i + 1}`,
      results: [],
    }));
    this.roundCount = clamp(Math.round(Number(rounds) || 0), MIN_ROUNDS, this.maxRounds(clean.length));
    this.assignments = this.#deal();
    this.phase = 'turn';
    this.#emit();
  }

  /** Vuelve a la pantalla inicial para armar otro torneo. */
  backToSetup() {
    this.reset();
    this.#emit();
  }

  /** Un mazo barajado repartido de una: una estatua distinta por turno. */
  #deal() {
    const deck = shuffle(this.pool);
    const table = [];
    let dealt = 0;

    for (let r = 0; r < this.roundCount; r++) {
      const row = [];
      for (let t = 0; t < this.teams.length; t++) {
        // maxRounds() ya garantiza que el mazo alcance; el reciclado es una red
        // por si alguien llama a start() con un pool mas chico de lo previsto.
        if (dealt >= deck.length) deck.push(...shuffle(this.pool));
        row.push(deck[dealt++]);
      }
      table.push(row);
    }
    return table;
  }

  get teamCount() {
    return this.teams.length;
  }

  /** @returns {Team|null} */
  get currentTeam() {
    return this.teams[this.teamIndex] ?? null;
  }

  get currentRound() {
    return this.assignments[this.roundIndex]?.[this.teamIndex] ?? null;
  }

  /** Resultado del turno que se acaba de jugar. */
  get currentResult() {
    return this.currentTeam?.results[this.roundIndex] ?? null;
  }

  /** Vuelta en juego, arrancando en 1. */
  get roundNumber() {
    return this.roundIndex + 1;
  }

  /** Turno dentro de la vuelta, arrancando en 1. */
  get turnNumber() {
    return this.teamIndex + 1;
  }

  /** Ultimo turno de la vuelta. */
  get isLastTeam() {
    return this.teamIndex + 1 >= this.teamCount;
  }

  get isLastRound() {
    return this.roundIndex + 1 >= this.roundCount;
  }

  /** Ultimo turno del torneo: despues viene la tabla final. */
  get isLastTurn() {
    return this.isLastRound && this.isLastTeam;
  }

  /** Equipos que todavia no jugaron en esta vuelta. */
  get upcomingNames() {
    return this.teams.slice(this.teamIndex + 1).map((t) => t.name);
  }

  get maxScore() {
    return MAX_SCORE;
  }

  /** Costo acumulado de las pistas abiertas en la ronda actual. */
  get currentPenalty() {
    return totalPenalty(this.revealedHints);
  }

  /** El equipo anunciado en pantalla arranca su turno. */
  beginTurn() {
    if (this.phase !== 'turn') return;

    this.guess = null;
    this.revealedHints = new Set();
    this.phase = 'playing';
    this.#emit();
  }

  // Ojo: revealHint y setGuess NO emiten.
  //
  // Los suscriptores redibujan la pantalla entera, y eso destruiria el mapa de
  // Leaflet y con el la provincia que el jugador acaba de marcar. Son cambios
  // dentro de una misma fase, asi que la UI los refleja localmente; solo las
  // transiciones de fase (beginTurn, submitGuess, next) disparan un re-render.

  revealHint(id) {
    if (this.phase !== 'playing' || this.revealedHints.has(id)) return;
    this.revealedHints.add(id);
  }

  /**
   * Selecciona una provincia. No confirma: se puede cambiar hasta apretar.
   * @param {{iso:string, name:string, centroid:{lat:number,lon:number}}} province
   */
  setGuess(province) {
    if (this.phase !== 'playing') return;
    this.guess = province;
  }

  /** Confirma la provincia elegida y calcula el resultado del turno. */
  submitGuess() {
    if (this.phase !== 'playing' || !this.guess) return;

    const team = this.currentTeam;
    const round = this.currentRound;
    const evaluation = evaluateProvinceGuess(this.guess, round, this.currentPenalty);

    team.results[this.roundIndex] = {
      roundNumber: this.roundNumber,
      round,
      guess: this.guess,
      hintsUsed: [...this.revealedHints],
      ...evaluation,
    };
    this.phase = 'revealed';
    this.#emit();
  }

  /** Pasa al turno siguiente, a la vuelta siguiente, o a la tabla final. */
  next() {
    if (this.phase !== 'revealed') return;

    if (this.isLastTurn) {
      this.phase = 'standings';
      this.#saveBestScore();
    } else {
      if (this.isLastTeam) {
        this.roundIndex++;
        this.teamIndex = 0;
      } else {
        this.teamIndex++;
      }
      this.guess = null;
      this.revealedHints = new Set();
      this.phase = 'turn';
    }
    this.#emit();
  }

  /**
   * Equipos ordenados por puntaje acumulado en todas las vueltas, de mayor a
   * menor y con la posicion ya calculada. Los empates comparten posicion.
   * @returns {Array<{name:string, results:Array<object>, correct:number, score:number, position:number}>}
   */
  get standings() {
    const sorted = this.teams
      .map((team) => {
        const results = team.results.filter(Boolean);
        return {
          name: team.name,
          results,
          correct: results.filter((r) => r.correct).length,
          score: results.reduce((sum, r) => sum + r.score, 0),
        };
      })
      .filter((t) => t.results.length > 0)
      .sort((a, b) => b.score - a.score);

    let position = 0;
    let previous = null;
    return sorted.map((team, i) => {
      if (previous === null || team.score !== previous) {
        position = i + 1;
        previous = team.score;
      }
      return { ...team, position };
    });
  }

  /**
   * El record se guarda por ronda, no por torneo: si fuera el total, jugar mas
   * vueltas alcanzaria para romperlo siempre.
   */
  #saveBestScore() {
    const winner = this.standings[0];
    const top = winner ? Math.round(winner.score / Math.max(1, winner.results.length)) : 0;
    try {
      const prev = Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
      if (top > prev) {
        localStorage.setItem(BEST_SCORE_KEY, String(top));
        this.isNewBest = true;
      } else {
        this.isNewBest = false;
      }
    } catch {
      // localStorage puede fallar en modo privado: no es critico.
      this.isNewBest = false;
    }
  }

  static bestScore() {
    try {
      return Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
    } catch {
      return 0;
    }
  }
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/** Fisher-Yates sobre una copia. */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
