// Pantalla inicial del torneo: los nombres de todos los equipos y cuantas
// vueltas se juegan. Recien despues arranca la primera ronda.

import { el } from './dom.js';
import { CREDIT, brandMark } from './brand.js';
import { MIN_TEAMS, DEFAULT_TEAMS, MIN_ROUNDS, DEFAULT_ROUNDS } from '../game.js';

/** @param {import('../game.js').Game} game */
export function renderSetup(game) {
  const maxTeams = game.maxTeams;
  /** Los nombres sobreviven a los cambios del stepper: nadie reescribe nada. */
  const names = [];

  let teamCount = clamp(DEFAULT_TEAMS, MIN_TEAMS, maxTeams);
  let roundCount = clamp(DEFAULT_ROUNDS, MIN_ROUNDS, game.maxRounds(teamCount));

  const list = el('div.team-list');
  const meta = el('div.meta');

  const teams = stepper({
    id: 'teams',
    label: '¿Cuántos equipos juegan?',
    min: MIN_TEAMS,
    max: maxTeams,
    value: teamCount,
    onChange: (n) => {
      teamCount = n;
      // Menos estatuas por vuelta: puede que ya no entren tantas rondas.
      rounds.setMax(game.maxRounds(teamCount));
      renderInputs();
      renderMeta();
    },
  });

  const rounds = stepper({
    id: 'rounds',
    label: '¿Cuántas rondas?',
    hint: 'cada ronda es una vuelta de todos los equipos',
    min: MIN_ROUNDS,
    max: game.maxRounds(teamCount),
    value: roundCount,
    onChange: (n) => {
      roundCount = n;
      renderMeta();
    },
  });

  function renderInputs() {
    list.replaceChildren(
      ...Array.from({ length: teamCount }, (_, i) => {
        const input = el('input.team-input', {
          type: 'text',
          value: names[i] ?? '',
          placeholder: `Equipo ${i + 1}`,
          maxlength: '40',
          autocomplete: 'off',
          'aria-label': `Nombre del equipo ${i + 1}`,
          oninput: () => {
            names[i] = input.value;
          },
          onkeydown: (e) => {
            if (e.key !== 'Enter') return;
            // Enter encadena los campos; en el ultimo, arranca el torneo.
            const next = list.querySelectorAll('input')[i + 1];
            if (next) next.focus();
            else start();
          },
        });
        return el('label.team-row', {}, [
          el('span.team-row__num', { text: String(i + 1) }),
          input,
        ]);
      })
    );
  }

  function renderMeta() {
    const turns = teamCount * roundCount;
    meta.textContent =
      `${game.pool.length} estatuas en el juego · ${turns} turnos, sin repetir foto` +
      (roundCount < game.maxRounds(teamCount) ? '' : ' (el máximo con esta cantidad de equipos)');
  }

  function start() {
    game.start(
      Array.from({ length: teamCount }, (_, i) => names[i] ?? ''),
      roundCount
    );
  }

  renderInputs();
  renderMeta();

  const root = el('div.start', {}, [
    brandMark(),
    el('h1', { text: 'GeoSanMartín' }),
    el('p', {
      text:
        'Torneo por equipos: en cada turno se ve la foto de una estatua del General ' +
        'José de San Martín y hay que elegir en el mapa en qué provincia está. Acertar ' +
        'vale 5.000 puntos; si errás, sumás algo igual según lo cerca que hayas quedado. ' +
        'Los puntajes se comparan al final.',
    }),
    el('div.setup-block', {}, [
      teams.node,
      el('div.team-field__label', { text: 'Nombres de los equipos' }),
      list,
      el('div.setup-note', { text: 'El que quede vacío juega como “Equipo N”.' }),
    ]),
    rounds.node,
    el('button.btn-primary', { text: 'Comenzar torneo', onclick: start }),
    meta,
    el('div.credit', { text: CREDIT }),
  ]);

  root.__mount = () => list.querySelector('input')?.focus();

  return root;
}

/**
 * Selector de a uno, con su etiqueta. Devuelve el nodo y un `setMax` porque el
 * tope de rondas depende de cuantos equipos haya.
 */
function stepper({ id, label, hint, min, max, value, onChange }) {
  // `wanted` es lo que pidio el usuario y `current` lo que permite el tope de
  // ahora. Se guardan por separado para que subir a 6 equipos —que baja el tope
  // de rondas a 2— no borre el 3 que habian elegido: al volver a 4, vuelve el 3.
  let wanted = value;
  let top = max;
  let current = Math.min(top, Math.max(min, wanted));

  const display = el('div.stepper__value', { text: String(current), 'aria-live': 'polite' });
  const minus = el('button.stepper__btn', { text: '−', 'aria-label': `Menos: ${label}` });
  const plus = el('button.stepper__btn', { text: '+', 'aria-label': `Más: ${label}` });

  function apply(notify = true) {
    const next = Math.min(top, Math.max(min, wanted));
    const changed = next !== current;
    current = next;
    display.textContent = String(current);
    minus.disabled = current === min;
    plus.disabled = current === top;
    if (changed && notify) onChange(current);
  }

  function nudge(delta) {
    wanted = Math.min(top, Math.max(min, current + delta));
    apply();
  }

  minus.addEventListener('click', () => nudge(-1));
  plus.addEventListener('click', () => nudge(+1));
  apply(false);

  const node = el(`div.team-field.team-field--${id}`, {}, [
    el('div.team-field__label', { text: label }),
    el(`div.stepper.stepper--${id}`, {}, [minus, display, plus]),
    hint && el('div.setup-note', { text: hint }),
  ]);

  return {
    node,
    setMax(next) {
      top = Math.max(min, next);
      apply(); // reclampea contra el tope nuevo y avisa si el valor cambio
    },
  };
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
