// Punto de entrada: carga las rondas, arma el Game y re-renderiza por fase.

import './styles.css';
import { Game } from './game.js';
import { el } from './ui/dom.js';
import { renderStart } from './ui/start.js';
import { renderRound } from './ui/round.js';
import { renderResult } from './ui/result.js';
import { renderSummary } from './ui/summary.js';
import { renderCredits } from './ui/credits.js';

const app = document.querySelector('#app');

let game = null;
let showingCredits = false;

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
  if (showingCredits) {
    show(
      renderCredits(game.pool, () => {
        showingCredits = false;
        render();
      })
    );
    return;
  }

  const handlers = {
    onCredits: () => {
      showingCredits = true;
      render();
    },
  };

  switch (game.phase) {
    case 'idle':
      show(renderStart(game, handlers));
      break;
    case 'playing':
      show(renderRound(game, handlers));
      break;
    case 'revealed':
      // La ronda queda de fondo, el resultado se superpone.
      show(renderRound(game, handlers), renderResult(game));
      break;
    case 'summary':
      show(renderSummary(game));
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
