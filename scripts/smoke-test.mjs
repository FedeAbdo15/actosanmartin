// Prueba de humo en un navegador real: juega una partida entera de 5 rondas.
//
//   npm run test:e2e
//
// Existe porque los tests unitarios no ven el DOM y dejaron pasar dos bugs que
// rompian el juego por completo:
//   1. Leaflet se construia sobre un nodo todavia desprendido, medía 0x0 y
//      fitBounds daba NaN: el mapa nunca aparecia.
//   2. setGuess() emitia y redibujaba la pantalla entera, destruyendo el mapa
//      y el boton apenas se elegia una provincia.
// Ambos daban tests unitarios en verde y un juego injugable.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4173;
const URL = `http://localhost:${PORT}/`;

const failures = [];
function check(cond, msg) {
  if (cond) console.log(`  ok   ${msg}`);
  else {
    console.log(`  FALLA ${msg}`);
    failures.push(msg);
  }
}

/** Busca un punto que caiga dentro de un poligono, no en su bounding box. */
async function clickProvincia(page) {
  const hit = await page.evaluate(() => {
    const b = document.querySelector('.guess-panel__map').getBoundingClientRect();
    for (let y = b.top + 5; y < b.bottom - 5; y += 3) {
      for (let x = b.left + 5; x < b.right - 5; x += 3) {
        const e = document.elementFromPoint(x, y);
        if (e && e.tagName.toLowerCase() === 'path') return { x, y };
      }
    }
    return null;
  });
  if (!hit) return false;
  await page.mouse.click(hit.x, hit.y);
  await page.waitForTimeout(250);
  return true;
}

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      /* todavia levantando */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// Se corre el entrypoint JS de vite con el mismo Node en vez de `npx` o el
// .cmd del bin: en Windows, spawnear un .cmd sin shell da EINVAL, y con shell
// los argumentos viajan sin escapar (DEP0190). Asi no hace falta ninguno.
const viteEntry = resolve(ROOT, 'node_modules/vite/bin/vite.js');

const server = spawn(
  process.execPath,
  [viteEntry, 'preview', '--port', String(PORT), '--strictPort'],
  { cwd: ROOT, stdio: 'ignore' }
);

let browser;
try {
  if (!(await waitForServer(URL))) throw new Error(`El servidor no respondio en ${URL}`);

  browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const jsErrors = [];
  const httpErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && jsErrors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && httpErrors.push(`${r.status()} ${r.url()}`));

  console.log('Inicio');
  await page.goto(URL, { waitUntil: 'networkidle' });
  check(await page.isVisible('text=Empezar partida'), 'la pantalla de inicio se ve');
  await page.click('text=Empezar partida');
  await page.waitForTimeout(1000);

  console.log('Mapa de provincias');
  const mapa = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.guess-panel__map path')]
      .map((p) => p.getBoundingClientRect())
      .filter((r) => r.width > 0);
    if (!b.length) return { paths: 0, ancho: 0, alto: 0 };
    return {
      paths: b.length,
      ancho: Math.round(Math.max(...b.map((x) => x.right)) - Math.min(...b.map((x) => x.left))),
      alto: Math.round(Math.max(...b.map((x) => x.bottom)) - Math.min(...b.map((x) => x.top))),
    };
  });
  check(mapa.paths >= 24, `se dibujan las 24 provincias (${mapa.paths})`);
  check(mapa.ancho > 150, `el mapa tiene ancho usable (${mapa.ancho}px)`);
  check(mapa.alto > 300, `el mapa tiene alto usable (${mapa.alto}px)`);
  check(await page.evaluate(() => document.querySelector('.round__photo')?.naturalWidth > 0),
    'la foto de la estatua carga');

  console.log('Partida de 5 rondas');
  let rondas = 0;
  for (let i = 1; i <= 5; i++) {
    await page.waitForTimeout(700);
    if (i === 2) await page.click('.hint-btn');
    if (!(await clickProvincia(page))) break;

    const habilitado = await page.isEnabled('.guess-panel__bar .btn-primary');
    if (i === 1) check(habilitado, 'elegir una provincia habilita el boton');
    if (!habilitado) break;

    await page.click('.guess-panel__bar .btn-primary');
    await page.waitForTimeout(1100);

    if (i === 1) {
      check(await page.isVisible('.verdict'), 'el resultado muestra el veredicto');
      check(
        (await page.evaluate(() => document.querySelectorAll('.reveal-map path').length)) > 0,
        'el mapa de resultado pinta las provincias'
      );
    }
    rondas++;
    await page.click('.sheet__actions .btn-primary');
  }
  check(rondas === 5, `se jugaron las 5 rondas (${rondas})`);

  console.log('Resumen');
  await page.waitForTimeout(700);
  const filas = await page.evaluate(() => document.querySelectorAll('.breakdown tbody tr').length);
  check(filas === 5, `el resumen lista las 5 rondas (${filas})`);
  check(await page.isVisible('text=Jugar de nuevo'), 'ofrece jugar de nuevo');

  await page.click('text=Jugar de nuevo');
  await page.waitForTimeout(900);
  check(
    (await page.evaluate(() => document.querySelectorAll('.guess-panel__map path').length)) >= 24,
    'al reiniciar el mapa se vuelve a dibujar'
  );

  console.log('Consola');
  check(jsErrors.length === 0, `sin errores de JavaScript${jsErrors.length ? ': ' + jsErrors[0] : ''}`);
  check(httpErrors.length === 0, `sin respuestas HTTP con error${httpErrors.length ? ': ' + httpErrors[0] : ''}`);
} catch (err) {
  failures.push(err.message);
  console.error('\nExcepcion:', err.message);
} finally {
  await browser?.close();
  server.kill();
}

if (failures.length) {
  console.error(`\n${failures.length} verificacion(es) fallaron.`);
  process.exit(1);
}
console.log('\nPrueba de humo OK.');
