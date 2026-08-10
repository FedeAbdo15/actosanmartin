// Punto de entrada: carga las rondas, arma el Game y re-renderiza por fase.

import './styles.css';
import { Game } from './game.js';
import { el } from './ui/dom.js';
import { renderSetup } from './ui/setup.js';
import { renderTeamName } from './ui/team.js';
import { renderRound } from './ui/round.js';
import { renderResult } from './ui/result.js';
import { renderStandings } from './ui/standings.js';

const app = document.querySelector('#app');

let game = null;

/**
 * Inserta las pantallas y recien despues corre su `__mount`.
 *
 * El orden importa: Leaflet mide el contenedor al construirse, asi que
 * cualquier mapa tiene que crearse con el nodo ya adentro del documento.
 */
function show(...nodes) {
  app.replaceChildren(...nodes);
  for (const node of nodes) node.__mount?.();
}

function render() {
  switch (game.phase) {
    case 'setup':
      show(renderSetup(game));
      break;
    case 'naming':
      show(renderTeamName(game));
      break;
    case 'playing':
      show(renderRound(game));
      break;
    case 'revealed':
      // La ronda queda de fondo, el resultado se superpone.
      show(renderRound(game), renderResult(game));
      break;
    case 'standings':
      show(renderStandings(game));
      break;
  }
}

async function boot() {
  show(el('div.loading', { text: 'Cargando estatuas...' }));

  let rounds;
  try {
    rounds = (await import('../data/rounds.json')).default;
  } catch {
    return fail(
      'No se encontro data/rounds.json.',
      'npm run data:osm && npm run data:photos && npm run data:rounds'
    );
  }

  if (!Array.isArray(rounds) || rounds.length === 0) {
    return fail('data/rounds.json esta vacio: no hay rondas curadas todavia.', 'npm run data:rounds');
  }

  game = new Game(rounds);
  game.subscribe(render);
  render();
}

function fail(message, command) {
  show(
    el('div.error', {}, [
      el('p', { text: message }),
      el('p', { text: 'Genera los datos con:' }),
      el('code', { text: command }),
    ])
  );
}

boot();
