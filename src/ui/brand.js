// La marca de Informatica: el logo, en sus dos tamanos.
//
// - mountWatermark(): el sello chico, fijo en una esquina de todas las
//   pantallas. Vive fuera de #app a proposito: main.js redibuja #app entero en
//   cada cambio de fase y, colgado del body, el logo se monta una sola vez y no
//   parpadea al pasar de una pantalla a la otra.
// - brandMark(): el logo grande que encabeza el inicio y los turnos.

import { el } from './dom.js';
import { asset } from '../assets.js';

export const CREDIT = 'Un juego de Informática · ORT';

/** Campus de Informatica: adonde lleva el logo. */
export const CAMPUS_URL = 'https://campus.ort.edu.ar/secundaria/almagro/informatica';

const LOGO = '/logo-info.png';
const ALT = 'Informática ORT';

/**
 * El logo es un link al campus. Siempre en pestaña nueva: el torneo vive en
 * memoria, asi que navegar en la misma pestaña perderia la partida en curso.
 */
function logoLink(className, size) {
  return el(`a.${className}`, {
    href: CAMPUS_URL,
    target: '_blank',
    rel: 'noopener',
    title: `${CREDIT} — ir al campus`,
  }, [
    el(`img.${className}__img`, {
      src: asset(LOGO),
      alt: ALT,
      width: String(size),
      height: String(size),
    }),
  ]);
}

export function mountWatermark(parent = document.body) {
  parent.append(el('div.watermark', {}, [logoLink('watermark__logo', 64)]));
}

/** Logo grande, en lugar del titulo de las pantallas de inicio y de turno. */
export function brandMark() {
  return logoLink('brand-mark', 96);
}
