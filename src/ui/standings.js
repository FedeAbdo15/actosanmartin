// Tabla final: todos los equipos del torneo, ordenados por puntaje.

import { el, fmt } from './dom.js';
import { Game } from '../game.js';
import { provinceName } from '../provinces.js';

/** @param {import('../game.js').Game} game */
export function renderStandings(game) {
  const table = game.standings;
  const best = Game.bestScore();
  const winners = table.filter((t) => t.position === 1);

  const rows = table.map((team) =>
    el('tr', {}, [
      el('td', {
        class: team.position === 1 ? 'pos is-winner' : 'pos',
        text: team.position === 1 ? '🏆' : String(team.position),
      }),
      el('td', { class: 'team', text: team.name }),
      // Cordoba capital esta en Cordoba: no repetir el nombre dos veces.
      el('td', {
        text: [
          ...new Set([team.round.locality, provinceName(team.round.provinceIso)].filter(Boolean)),
        ].join(', '),
      }),
      el('td', {
        class: team.result.correct ? 'ok' : 'bad',
        text: `${team.result.correct ? '✓' : '✗'} ${provinceName(team.result.guessedIso)}`,
      }),
      el('td', {
        class: 'num',
        text: fmt(team.result.score),
      }),
    ])
  );

  const card = el('div.sheet__card', {}, [
    el('h2', { text: 'Tabla final' }),
    el('div.score-total.score-total--name', {}, [
      winners.length > 1 ? 'Empate' : winners[0]?.name ?? '',
      el('small', { text: ` · ${fmt(winners[0]?.result.score ?? 0)} pts` }),
      game.isNewBest && el('span.new-best', { text: '¡Récord!' }),
    ]),
    winners.length > 1 &&
      el('div', {
        class: 'stat',
        html: `<span class="label">Ganan empatados: ${winners.map((w) => w.name).join(' y ')}</span>`,
      }),
    el('table.breakdown', {}, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: '#' }),
          el('th', { text: 'Equipo' }),
          el('th', { text: 'Le tocó' }),
          el('th', { text: 'Eligió' }),
          el('th', { class: 'num', text: 'Puntos' }),
        ]),
      ]),
      el('tbody', {}, rows),
    ]),
    !game.isNewBest && best > 0
      ? el('div', {
          class: 'stat',
          html: `<span class="label">Mejor puntaje histórico: ${fmt(best)} pts</span>`,
        })
      : null,
    el('div.sheet__actions', {}, [
      el('button.btn-primary', { text: 'Nuevo torneo', onclick: () => game.backToSetup() }),
    ]),
  ]);

  return el('div.sheet', {}, [card]);
}
