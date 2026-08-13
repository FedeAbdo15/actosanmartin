// Pantalla de resultado de una ronda: si acertaste la provincia y donde estaba.

import { el, fmt } from './dom.js';
import { createRevealMap } from '../map.js';
import { provinceName } from '../provinces.js';

/** @param {import('../game.js').Game} game */
export function renderResult(game) {
  const team = game.currentTeam;
  const { round, correct, guessedIso, score, baseScore, hintPenalty } = game.currentResult;

  const mapBox = el('div.reveal-map');

  const card = el('div.sheet__card', {}, [
    el('div.result-head', {}, [
      el('div', {
        class: `verdict ${correct ? 'verdict--ok' : 'verdict--bad'}`,
        text: correct ? '¡Correcto!' : 'No era esa',
      }),
      el('span.turn-chip', {
        text: `Equipo ${team.name} · Ronda ${game.roundNumber} de ${game.roundCount}`,
      }),
    ]),
    el('h2', { text: round.name }),
    el('div', {
      class: 'stat',
      // Cordoba capital esta en Cordoba: no repetir el nombre dos veces.
      html: `<span class="label">${[
        ...new Set([round.locality, provinceName(round.provinceIso)].filter(Boolean)),
      ].join(', ')}</span>`,
    }),
    mapBox,
    el('div.result-stats', {}, [
      el('div.stat', {}, [
        el('div.label', { text: 'Elegiste' }),
        el('div', {
          class: `value province ${correct ? 'is-ok' : 'is-bad'}`,
          text: provinceName(guessedIso),
        }),
      ]),
      !correct &&
        el('div.stat', {}, [
          el('div.label', { text: 'Era' }),
          el('div', { class: 'value province is-ok', text: provinceName(round.provinceIso) }),
        ]),
      el('div.stat', {}, [
        el('div.label', { text: 'Puntos' }),
        el('div', { class: 'value pts', text: `${fmt(score)} / 5.000` }),
        hintPenalty > 0 &&
          el('div.penalty', { text: `${fmt(baseScore)} − ${fmt(hintPenalty)} por pistas` }),
      ]),
    ]),
    renderAttribution(round),
    el('div.sheet__actions', {}, [
      el('button.btn-primary', {
        text: nextLabel(game),
        onclick: () => game.next(),
      }),
    ]),
  ]);

  const root = el('div.sheet', {}, [card]);

  // Igual que en la ronda: Leaflet se instancia recien cuando el nodo esta en
  // el documento y tiene tamano medible.
  root.__mount = () => createRevealMap(mapBox, round, guessedIso);

  return root;
}

/** Que viene despues: otro equipo, la vuelta siguiente o la tabla final. */
function nextLabel(game) {
  if (game.isLastTurn) return 'Ver tabla final';
  if (game.isLastTeam) return `Empezar la ronda ${game.roundNumber + 1}`;
  return 'Siguiente equipo';
}

/** Requisito de las licencias CC BY / CC BY-SA de Wikimedia Commons. */
function renderAttribution(round) {
  const a = round.attribution;
  if (!a) return null;

  const parts = [];
  if (a.artist) parts.push(`Foto: ${a.artist}`);
  if (a.license) parts.push(a.license);

  return el('div.attribution', {}, [
    parts.join(' · '),
    a.commonsUrl && ' — ',
    a.commonsUrl &&
      el('a', { href: a.commonsUrl, target: '_blank', rel: 'noopener', text: 'Wikimedia Commons' }),
  ]);
}
