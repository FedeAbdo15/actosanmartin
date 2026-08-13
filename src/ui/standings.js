// Tabla final: todos los equipos del torneo, ordenados por puntaje acumulado
// en todas las rondas, con el detalle vuelta por vuelta abajo.

import { el, fmt } from './dom.js';
import { Game } from '../game.js';
import { provinceName } from '../provinces.js';

/** @param {import('../game.js').Game} game */
export function renderStandings(game) {
  const table = game.standings;
  const best = Game.bestScore();
  const winners = table.filter((t) => t.position === 1);
  const rounds = game.roundCount;

  const rows = table.map((team) =>
    el('tr', {}, [
      el('td', {
        class: team.position === 1 ? 'pos is-winner' : 'pos',
        text: team.position === 1 ? '🏆' : String(team.position),
      }),
      el('td', { class: 'team', text: team.name }),
      el('td', {
        class: 'num',
        text: `${team.correct} de ${team.results.length}`,
      }),
      el('td', {
        class: 'num',
        text: fmt(Math.round(team.score / Math.max(1, team.results.length))),
      }),
      el('td', { class: 'num total', text: fmt(team.score) }),
    ])
  );

  const card = el('div.sheet__card', {}, [
    el('h2', { text: 'Tabla final' }),
    el('div.score-total.score-total--name', {}, [
      winners.length > 1 ? 'Empate' : winners[0]?.name ?? '',
      el('small', { text: ` · ${fmt(winners[0]?.score ?? 0)} pts` }),
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
          el('th', { class: 'num', text: 'Aciertos' }),
          el('th', { class: 'num', text: 'Promedio' }),
          el('th', { class: 'num', text: 'Total' }),
        ]),
      ]),
      el('tbody', {}, rows),
    ]),
    renderRoundDetail(game),
    !game.isNewBest && best > 0
      ? el('div', {
          class: 'stat',
          html: `<span class="label">Mejor promedio por ronda: ${fmt(best)} pts</span>`,
        })
      : null,
    el('div.meta.standings-meta', {
      text: `${rounds} ${rounds === 1 ? 'ronda jugada' : 'rondas jugadas'} · ${
        game.teamCount * rounds
      } estatuas, todas distintas`,
    }),
    el('div.sheet__actions', {}, [
      el('button.btn-primary', { text: 'Nuevo torneo', onclick: () => game.backToSetup() }),
    ]),
  ]);

  return el('div.sheet', {}, [card]);
}

/** Una tabla chica por vuelta: que estatua le toco a cada equipo y que eligio. */
function renderRoundDetail(game) {
  const detail = el('details.rounds-detail', {}, [
    el('summary', { text: 'Detalle ronda por ronda' }),
    ...Array.from({ length: game.roundCount }, (_, r) =>
      el('div.round-block', {}, [
        el('h3', { text: `Ronda ${r + 1}` }),
        el('table.breakdown.breakdown--sub', {}, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { text: 'Equipo' }),
              el('th', { text: 'Le tocó' }),
              el('th', { text: 'Eligió' }),
              el('th', { class: 'num', text: 'Puntos' }),
            ]),
          ]),
          el(
            'tbody',
            {},
            game.teams.map((team) => {
              const result = team.results[r];
              if (!result) return null;
              return el('tr', {}, [
                el('td', { class: 'team', text: team.name }),
                // Cordoba capital esta en Cordoba: no repetir el nombre dos veces.
                el('td', {
                  text: [
                    ...new Set(
                      [result.round.locality, provinceName(result.round.provinceIso)].filter(Boolean)
                    ),
                  ].join(', '),
                }),
                el('td', {
                  class: result.correct ? 'ok' : 'bad',
                  text: `${result.correct ? '✓' : '✗'} ${provinceName(result.guessedIso)}`,
                }),
                el('td', { class: 'num', text: fmt(result.score) }),
              ]);
            })
          ),
        ]),
      ])
    ),
  ]);

  // Con una sola vuelta el detalle es toda la informacion del torneo: se abre.
  if (game.roundCount === 1) detail.setAttribute('open', '');
  return detail;
}
