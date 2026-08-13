// Pantalla entre turnos: anuncia a que equipo le toca jugar.
//
// Los nombres ya se cargaron en el inicio, asi que aca no se escribe nada: es
// el corte para pasar la compu de un equipo al siguiente.

import { el } from './dom.js';
import { brandMark } from './brand.js';

/** @param {import('../game.js').Game} game */
export function renderTurn(game) {
  const startBtn = el('button.btn-primary', {
    text: 'Empezar ronda',
    onclick: () => game.beginTurn(),
  });

  const upcoming = game.upcomingNames;

  const root = el('div.start', {}, [
    brandMark(),
    el('div.turn-chip', {
      text:
        `Ronda ${game.roundNumber} de ${game.roundCount}` +
        ` · Turno ${game.turnNumber} de ${game.teamCount}`,
    }),
    el('h1', { text: game.currentTeam.name }),
    el('p', {
      text: 'Les toca. Miren la foto de la estatua y marquen en el mapa en qué provincia está.',
    }),
    startBtn,
    // Sin puntajes: recien se ven todos juntos en la tabla final.
    el('div.meta', {
      text:
        upcoming.length > 0
          ? `Después juegan: ${upcoming.join(' · ')}`
          : `Último turno de la ronda ${game.roundNumber}`,
    }),
  ]);

  root.__mount = () => startBtn.focus();

  return root;
}
