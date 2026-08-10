// Pantalla inicial del torneo: cuantos equipos juegan.

import { el } from './dom.js';
import { MIN_TEAMS, MAX_TEAMS, DEFAULT_TEAMS } from '../game.js';

/** @param {import('../game.js').Game} game */
export function renderSetup(game) {
  let count = DEFAULT_TEAMS;

  const value = el('div.stepper__value', { text: String(count), 'aria-live': 'polite' });
  const minus = el('button.stepper__btn', { text: '−', 'aria-label': 'Un equipo menos' });
  const plus = el('button.stepper__btn', { text: '+', 'aria-label': 'Un equipo mas' });

  function setCount(n) {
    count = Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, n));
    value.textContent = String(count);
    minus.disabled = count === MIN_TEAMS;
    plus.disabled = count === MAX_TEAMS;
  }

  minus.addEventListener('click', () => setCount(count - 1));
  plus.addEventListener('click', () => setCount(count + 1));
  setCount(count);

  return el('div.start', {}, [
    el('div.sun', { text: '🌞' }),
    el('h1', { text: 'GeoSanMartín' }),
    el('p', {
      text:
        'Torneo por equipos: a cada equipo le toca una estatua del General José de San ' +
        'Martín y tiene que elegir en el mapa en qué provincia está. Acertar vale 5.000 ' +
        'puntos; si errás, sumás algo igual según lo cerca que hayas quedado. Los puntajes ' +
        'se comparan al final.',
    }),
    el('div.team-field', {}, [
      el('div.team-field__label', { text: '¿Cuántos equipos juegan?' }),
      el('div.stepper', {}, [minus, value, plus]),
    ]),
    el('button.btn-primary', {
      text: 'Comenzar torneo',
      onclick: () => game.setTeamCount(count),
    }),
    el('div.meta', {
      text: `${game.pool.length} estatuas en el juego · 1 ronda por equipo`,
    }),
  ]);
}
