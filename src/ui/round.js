// Pantalla de ronda: foto, pistas y mapa para marcar.

import { el } from './dom.js';
import { asset } from '../assets.js';
import { availableHints } from '../hints.js';
import { createProvinceMap } from '../map.js';

/** @param {import('../game.js').Game} game */
export function renderRound(game) {
  const round = game.currentRound;

  const photo = el('img.round__photo', {
    src: asset(round.photo),
    alt: 'Estatua de San Martin en un lugar de Argentina por descubrir',
    onclick: () => photo.classList.toggle('zoomed'),
  });

  // Sin puntaje en la barra: los numeros recien se muestran en la tabla final.
  const topbar = el('div.topbar', {}, [
    el('strong', { text: 'GeoSanMartín' }),
    el('span.chip', { text: `Equipo ${game.currentTeam.name}` }),
    el('div.spacer'),
    el('span.chip', { text: `Ronda ${game.roundNumber} de ${game.roundCount}` }),
    el('span.chip', { text: `Turno ${game.turnNumber} de ${game.teamCount}` }),
  ]);

  const hintsBox = el('div.hints');
  renderHints();

  const mapBox = el('div.guess-panel__map');
  const confirmBtn = el('button.btn-primary', {
    text: 'Elegí una provincia',
    disabled: true,
    onclick: () => game.submitGuess(),
  });

  const panel = el('div.guess-panel', {}, [
    mapBox,
    el('div.guess-panel__bar', {}, [
      confirmBtn,
      el('button.icon-btn', {
        text: '⤢',
        title: 'Agrandar / achicar el mapa',
        onclick: () => {
          panel.classList.toggle('expanded');
          // El contenedor cambio de tamano: Leaflet necesita recalcular.
          setTimeout(() => guessMap?.refresh(), 200);
        },
      }),
    ]),
  ]);

  const root = el('div.round', {}, [photo, topbar, hintsBox, panel]);

  // Leaflet mide el contenedor al construirse. Si lo hace sobre un nodo todavia
  // desprendido, lee 0x0, fitBounds da NaN y el mapa queda muerto para siempre
  // (ni invalidateSize lo recupera). Por eso se instancia en __mount, que main.js
  // llama recien despues de insertar el arbol en el documento.
  let guessMap = null;
  root.__mount = () => {
    guessMap = createProvinceMap(mapBox, (province) => {
      game.setGuess(province);
      confirmBtn.disabled = false;
      confirmBtn.textContent = `Confirmar: ${province.name}`;
    });
  };

  function renderHints() {
    hintsBox.replaceChildren(
      ...availableHints(round).map((hint) => {
        if (game.revealedHints.has(hint.id)) {
          return el('div.hint-revealed', {}, [
            el('b', { text: hint.label }),
            hint.get(round),
          ]);
        }
        return el('button.hint-btn', {
          onclick: () => {
            game.revealHint(hint.id);
            renderHints();
          },
          html: `Pista: ${hint.label} <span class="cost">−${hint.cost}</span>`,
        });
      })
    );
  }

  return root;
}
