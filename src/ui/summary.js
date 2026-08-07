// Resumen final de la partida.

import { el, fmt } from './dom.js';
import { Game } from '../game.js';
import { provinceName } from '../provinces.js';

/** @param {import('../game.js').Game} game */
export function renderSummary(game) {
  const best = Game.bestScore();

  const aciertos = game.results.filter((r) => r.correct).length;

  const rows = game.results.map((r, i) =>
    el('tr', {}, [
      el('td', { text: String(i + 1) }),
      el('td', { text: r.round.locality }),
      el('td', {
        class: r.correct ? 'ok' : 'bad',
        text: `${r.correct ? '✓' : '✗'} ${provinceName(r.guessedIso)}`,
      }),
      el('td', { text: r.correct ? '' : provinceName(r.round.provinceIso) }),
      el('td', { class: 'num', text: fmt(r.score) }),
    ])
  );

  const card = el('div.sheet__card', {}, [
    el('h2', { text: 'Resultado final' }),
    el('div.score-total', {}, [
      fmt(game.totalScore),
      el('small', { text: ` / ${fmt(game.maxScore)} pts` }),
      game.isNewBest && el('span.new-best', { text: '¡Récord!' }),
    ]),
    !game.isNewBest && best > 0
      ? el('div', { class: 'stat', html: `<span class="label">Tu récord: ${fmt(best)} pts</span>` })
      : null,
    el('div', {
      class: 'stat',
      html: `<span class="label">${aciertos} de ${game.totalRounds} provincias acertadas</span>`,
    }),
    el('table.breakdown', {}, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: '#' }),
          el('th', { text: 'Localidad' }),
          el('th', { text: 'Elegiste' }),
          el('th', { text: 'Era' }),
          el('th', { class: 'num', text: 'Puntos' }),
        ]),
      ]),
      el('tbody', {}, rows),
    ]),
    el('div.sheet__actions', {}, [
      el('button.btn-primary', { text: 'Jugar de nuevo', onclick: () => game.start() }),
    ]),
  ]);

  return el('div.sheet', {}, [card]);
}
