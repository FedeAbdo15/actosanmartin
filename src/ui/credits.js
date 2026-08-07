// Creditos de las fotos. Requisito de las licencias CC BY / CC BY-SA:
// autor, licencia y link al original de todas las imagenes usadas.

import { el } from './dom.js';

/**
 * @param {Array<object>} rounds pool completo, no solo las de la partida
 * @param {()=>void} onClose
 */
export function renderCredits(rounds, onClose) {
  const items = rounds
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((r) => {
      const a = r.attribution ?? {};
      const place = [r.locality, r.province].filter(Boolean).join(', ');
      return el('li', {}, [
        el('strong', { text: r.name }),
        place && ` — ${place}`,
        el('br'),
        [a.artist && `Foto: ${a.artist}`, a.license].filter(Boolean).join(' · '),
        a.commonsUrl && ' — ',
        a.commonsUrl &&
          el('a', {
            href: a.commonsUrl,
            target: '_blank',
            rel: 'noopener',
            text: 'ver original',
          }),
      ]);
    });

  const card = el('div.sheet__card', {}, [
    el('h2', { text: 'Créditos de las fotos' }),
    el('p', {
      class: 'attribution',
      style: 'border-top:0;margin-top:0;padding-top:0',
      html:
        'Imágenes de <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>, ' +
        'bajo las licencias indicadas en cada caso. Ubicaciones de ' +
        '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (ODbL).',
    }),
    el('ul.credits-list', {}, items),
    el('div.sheet__actions', {}, [
      el('button.btn-primary', { text: 'Volver', onclick: onClose }),
    ]),
  ]);

  return el('div.sheet', {}, [card]);
}
