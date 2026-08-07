// Maquina de estados de la partida. No toca el DOM: la UI se suscribe.

import { evaluateProvinceGuess, ROUNDS_PER_GAME, MAX_GAME_SCORE } from './scoring.js';
import { totalPenalty } from './hints.js';

const BEST_SCORE_KEY = 'geosanmartin.bestScore';

/** @typedef {'idle'|'playing'|'revealed'|'summary'} Phase */

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
    this.phase = 'idle';
    this.rounds = [];
    this.index = 0;
    /** @type {Array<object>} */
    this.results = [];
    this.guess = null;
    /** @type {Set<string>} */
    this.revealedHints = new Set();
  }

  start() {
    // Muestreo sin repeticion. Si el pool es menor a 5 rondas, la partida se
    // acorta en vez de repetir estatuas.
    const n = Math.min(ROUNDS_PER_GAME, this.pool.length);
    this.reset();
    this.rounds = shuffle(this.pool).slice(0, n);
    this.phase = 'playing';
    this.#emit();
  }

  get currentRound() {
    return this.rounds[this.index] ?? null;
  }

  get totalRounds() {
    return this.rounds.length;
  }

  get totalScore() {
    return this.results.reduce((sum, r) => sum + r.score, 0);
  }

  /** Costo acumulado de las pistas abiertas en la ronda actual. */
  get currentPenalty() {
    return totalPenalty(this.revealedHints);
  }

  // Ojo: revealHint y setGuess NO emiten.
  //
  // Los suscriptores redibujan la pantalla entera, y eso destruiria el mapa de
  // Leaflet y con el la provincia que el jugador acaba de marcar. Son cambios
  // dentro de una misma fase, asi que la UI los refleja localmente; solo las
  // transiciones de fase (start, submitGuess, next) disparan un re-render.

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

    const round = this.currentRound;
    const evaluation = evaluateProvinceGuess(this.guess, round, this.currentPenalty);

    this.results.push({
      round,
      guess: this.guess,
      hintsUsed: [...this.revealedHints],
      ...evaluation,
    });
    this.phase = 'revealed';
    this.#emit();
  }

  /** Avanza a la ronda siguiente, o al resumen si fue la ultima. */
  next() {
    if (this.phase !== 'revealed') return;

    if (this.index + 1 >= this.rounds.length) {
      this.phase = 'summary';
      this.#saveBestScore();
    } else {
      this.index++;
      this.guess = null;
      this.revealedHints = new Set();
      this.phase = 'playing';
    }
    this.#emit();
  }

  get maxScore() {
    return this.rounds.length * (MAX_GAME_SCORE / ROUNDS_PER_GAME);
  }

  #saveBestScore() {
    try {
      const prev = Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
      if (this.totalScore > prev) {
        localStorage.setItem(BEST_SCORE_KEY, String(this.totalScore));
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

/** Fisher-Yates sobre una copia. */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
