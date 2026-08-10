// Maquina de estados del torneo. No toca el DOM: la UI se suscribe.
//
// Formato: se elige cuantos equipos juegan, despues cada equipo carga su nombre
// y juega una unica ronda. Los puntajes recien se muestran juntos, en la tabla
// final.

import { evaluateProvinceGuess, MAX_SCORE } from './scoring.js';
import { totalPenalty } from './hints.js';

const BEST_SCORE_KEY = 'geosanmartin.bestScore';

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 12;
export const DEFAULT_TEAMS = 4;

/** @typedef {'setup'|'naming'|'playing'|'revealed'|'standings'} Phase */
/** @typedef {{name:string, round:object, result:object|null}} Team */

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
    this.teamCount = DEFAULT_TEAMS;
    /** @type {Array<Team>} */
    this.teams = [];
    this.teamIndex = 0;
    /** Mazo barajado: a cada equipo le toca una estatua distinta. */
    this.deck = [];
    this.guess = null;
    /** @type {Set<string>} */
    this.revealedHints = new Set();
    this.isNewBest = false;
  }

  /** Arranca un torneo de `n` equipos y pasa a cargar el nombre del primero. */
  setTeamCount(n) {
    const count = clamp(Math.round(Number(n) || 0), MIN_TEAMS, MAX_TEAMS);
    this.reset();
    this.teamCount = count;
    this.deck = shuffle(this.pool);
    this.phase = 'naming';
    this.#emit();
  }

  /** Vuelve a la pantalla inicial para armar otro torneo. */
  backToSetup() {
    this.reset();
    this.#emit();
  }

  /** @returns {Team|null} */
  get currentTeam() {
    return this.teams[this.teamIndex] ?? null;
  }

  get currentRound() {
    return this.currentTeam?.round ?? null;
  }

  /** Numero de turno que se esta jugando, arrancando en 1. */
  get turnNumber() {
    return this.teamIndex + 1;
  }

  get isLastTeam() {
    return this.teamIndex + 1 >= this.teamCount;
  }

  /** Nombres de los equipos que ya jugaron su ronda. */
  get playedNames() {
    return this.teams.filter((t) => t?.result).map((t) => t.name);
  }

  get maxScore() {
    return MAX_SCORE;
  }

  /** Costo acumulado de las pistas abiertas en la ronda actual. */
  get currentPenalty() {
    return totalPenalty(this.revealedHints);
  }

  /**
   * El equipo de turno carga su nombre y empieza su ronda.
   * @param {string} name
   */
  startTurn(name) {
    if (this.phase !== 'naming') return;

    const clean = String(name).trim();
    // Si el torneo tiene mas equipos que estatuas curadas, el mazo se recicla.
    const round = this.deck[this.teamIndex % this.deck.length];

    this.teams[this.teamIndex] = {
      name: clean || `Equipo ${this.turnNumber}`,
      round,
      result: null,
    };
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
  // transiciones de fase (startTurn, submitGuess, next) disparan un re-render.

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

  /** Confirma la provincia elegida y calcula el resultado de la ronda. */
  submitGuess() {
    if (this.phase !== 'playing' || !this.guess) return;

    const team = this.currentTeam;
    const evaluation = evaluateProvinceGuess(this.guess, team.round, this.currentPenalty);

    team.result = {
      round: team.round,
      guess: this.guess,
      hintsUsed: [...this.revealedHints],
      ...evaluation,
    };
    this.phase = 'revealed';
    this.#emit();
  }

  /** Pasa al equipo siguiente, o a la tabla final si ya jugaron todos. */
  next() {
    if (this.phase !== 'revealed') return;

    if (this.isLastTeam) {
      this.phase = 'standings';
      this.#saveBestScore();
    } else {
      this.teamIndex++;
      this.guess = null;
      this.revealedHints = new Set();
      this.phase = 'naming';
    }
    this.#emit();
  }

  /**
   * Equipos ordenados por puntaje, de mayor a menor, con la posicion ya
   * calculada. Los empates comparten posicion.
   * @returns {Array<Team & {position:number}>}
   */
  get standings() {
    const sorted = this.teams.filter((t) => t?.result).sort((a, b) => b.result.score - a.result.score);

    let position = 0;
    let previous = null;
    return sorted.map((team, i) => {
      if (previous === null || team.result.score !== previous) {
        position = i + 1;
        previous = team.result.score;
      }
      return { ...team, position };
    });
  }

  #saveBestScore() {
    const top = this.standings[0]?.result.score ?? 0;
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
