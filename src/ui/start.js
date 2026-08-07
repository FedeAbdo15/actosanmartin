// Pantalla de inicio.

import { el, fmt } from './dom.js';
import { Game } from '../game.js';

/**
 * @param {import('../game.js').Game} game
 * @param {{onCredits:()=>void}} handlers
 */
export function renderStart(game, { onCredits }) {
  const best = Game.bestScore();

  return el('div.start', {}, [
    el('div.sun', { text: '🌞' }),
    el('h1', { text: 'GeoSanMartín' }),
    el('p', {
      text:
        'Cada ronda te muestra una estatua del General José de San Martín en algún ' +
        'punto de Argentina. Elegí en el mapa en qué provincia está. Acertar vale 5.000 ' +
        'puntos; si errás, sumás algo igual según lo cerca que hayas quedado.',
    }),
    el('button.btn-primary', { text: 'Empezar partida', onclick: () => game.start() }),
    el('div.meta', {
      text: `${game.pool.length} estatuas en el juego · ${Math.min(5, game.pool.length)} rondas por partida`,
    }),
    best > 0 && el('div.meta', { text: `Tu récord: ${fmt(best)} pts` }),
    el('button.link-btn', { text: 'Créditos de las fotos', onclick: onCredits }),
  ]);
}
