// Pantalla entre turnos: el equipo que sigue carga su nombre.

import { el } from './dom.js';

/** @param {import('../game.js').Game} game */
export function renderTeamName(game) {
  const input = el('input.team-input', {
    id: 'team-name',
    type: 'text',
    placeholder: `Equipo ${game.turnNumber}`,
    maxlength: '40',
    autocomplete: 'off',
    'aria-label': 'Nombre del equipo',
    oninput: () => {
      startBtn.disabled = input.value.trim() === '';
    },
    onkeydown: (e) => {
      if (e.key === 'Enter') startTurn();
    },
  });

  const startBtn = el('button.btn-primary', {
    text: 'Empezar ronda',
    disabled: true,
    onclick: () => startTurn(),
  });

  function startTurn() {
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    game.startTurn(name);
  }

  const played = game.playedNames;

  const root = el('div.start', {}, [
    el('div.sun', { text: '🌞' }),
    el('div.turn-chip', { text: `Turno ${game.turnNumber} de ${game.teamCount}` }),
    el('h1', { text: '¿Qué equipo juega?' }),
    el('p', {
      text: 'Escriban el nombre del equipo y arranca la ronda. Cada equipo juega una sola.',
    }),
    el('div.team-field', {}, [input]),
    startBtn,
    // Sin puntajes: recien se ven todos juntos en la tabla final.
    played.length > 0 && el('div.meta', { text: `Ya jugaron: ${played.join(' · ')}` }),
  ]);

  root.__mount = () => input.focus();

  return root;
}
