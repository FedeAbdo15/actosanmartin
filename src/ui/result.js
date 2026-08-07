// Pantalla de resultado de una ronda: si acertaste la provincia y donde estaba.

import { el, fmt } from './dom.js';
import { createRevealMap } from '../map.js';
import { provinceName } from '../provinces.js';

/** @param {import('../game.js').Game} game */
export function renderResult(game) {
  const result = game.results[game.results.length - 1];
  const { round, correct, guessedIso, score, baseScore, hintPenalty } = result;

  const mapBox = el('div.reveal-map');
  const isLast = game.index + 1 >= game.totalRounds;

  const card = el('div.sheet__card', {}, [
    el('div', {
      class: `verdict ${correct ? 'verdict--ok' : 'verdict--bad'}`,
      text: correct ? '¡Correcto!' : 'No era esa',
    }),
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
        text: isLast ? 'Ver resultado final' : 'Siguiente ronda',
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

/** Requisito de las licencias CC BY / CC BY-SA de Wikimedia Commons. */
export function renderAttribution(round) {
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
