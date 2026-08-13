// Prueba de humo en un navegador real: juega un torneo entero de tres equipos
// a dos rondas (dos vueltas completas, seis turnos).
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

  const EQUIPOS = ['Los Granaderos', 'La Sanmartiniana', 'Cruce de los Andes'];
  const RONDAS = 2;

  console.log('Inicio: equipos y rondas');
  await page.goto(URL, { waitUntil: 'networkidle' });
  check(await page.isVisible('.stepper--teams'), 'la pantalla de inicio pide la cantidad de equipos');
  check(await page.isVisible('.stepper--rounds'), 'la pantalla de inicio pide la cantidad de rondas');

  // Arranca en 4 equipos: se baja a 3 con el boton de menos.
  await page.click('.stepper--teams .stepper__btn >> nth=0');
  check(
    (await page.textContent('.stepper--teams .stepper__value')) === String(EQUIPOS.length),
    `el selector queda en ${EQUIPOS.length} equipos`
  );
  check(
    (await page.locator('.team-list input').count()) === EQUIPOS.length,
    'hay un campo de nombre por equipo'
  );

  // Con 3 equipos y 15 estatuas entran 5 rondas: se baja a 2.
  const rondasIniciales = Number(await page.textContent('.stepper--rounds .stepper__value'));
  for (let i = rondasIniciales; i > RONDAS; i--) {
    await page.click('.stepper--rounds .stepper__btn >> nth=0');
  }
  check(
    (await page.textContent('.stepper--rounds .stepper__value')) === String(RONDAS),
    `el selector queda en ${RONDAS} rondas`
  );

  console.log('Nombres de todos los equipos');
  for (let i = 0; i < EQUIPOS.length; i++) {
    await page.fill(`.team-list input >> nth=${i}`, EQUIPOS[i]);
  }
  await page.click('.start .btn-primary');
  await page.waitForTimeout(400);

  console.log('Primer turno');
  check(
    await page.isVisible(`.start h1:text-is("${EQUIPOS[0]}")`),
    'el primer turno anuncia al primer equipo sin volver a pedir el nombre'
  );
  check(
    (await page.locator('.team-input').count()) === 0,
    'entre turnos ya no se piden nombres'
  );
  check(
    (await page.textContent('.turn-chip')).includes(`Ronda 1 de ${RONDAS}`),
    'el turno muestra en que ronda va el torneo'
  );
  await page.click('.start .btn-primary');
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
  check(await page.isVisible(`text=Equipo ${EQUIPOS[0]}`), 'la ronda muestra el equipo que juega');

  console.log(`Turnos: ${RONDAS} rondas de ${EQUIPOS.length} equipos`);
  const fotos = [];
  const TURNOS = RONDAS * EQUIPOS.length;
  let cortado = false;

  for (let ronda = 1; ronda <= RONDAS && !cortado; ronda++) {
    for (let i = 0; i < EQUIPOS.length; i++) {
      const primero = ronda === 1 && i === 0;
      const ultimo = ronda === RONDAS && i === EQUIPOS.length - 1;

      if (!primero) {
        // El turno arranca en la pantalla que anuncia al equipo.
        check(
          await page.isVisible(`.start h1:text-is("${EQUIPOS[i]}")`),
          `la ronda ${ronda} le da el turno a ${EQUIPOS[i]}`
        );
        await page.click('.start .btn-primary');
        await page.waitForTimeout(1000);
      }

      await page.waitForTimeout(600);
      check(
        await page.isVisible(`text=Ronda ${ronda} de ${RONDAS}`),
        `la ronda ${ronda} se anuncia en la barra`
      );
      // La foto identifica la estatua mejor que el titulo: hay nombres repetidos.
      fotos.push(await page.getAttribute('.round__photo', 'src'));
      if (primero) await page.click('.hint-btn');
      if (!(await clickProvincia(page))) {
        check(false, `el equipo ${EQUIPOS[i]} pudo marcar una provincia`);
        cortado = true;
        break;
      }

      const habilitado = await page.isEnabled('.guess-panel__bar .btn-primary');
      if (primero) check(habilitado, 'elegir una provincia habilita el boton');
      if (!habilitado) {
        cortado = true;
        break;
      }

      await page.click('.guess-panel__bar .btn-primary');
      await page.waitForTimeout(1100);

      if (primero) {
        check(await page.isVisible('.verdict'), 'el resultado muestra el veredicto');
        check(
          (await page.evaluate(() => document.querySelectorAll('.reveal-map path').length)) > 0,
          'el mapa de resultado pinta las provincias'
        );
      }
      const boton = (await page.textContent('.sheet__actions .btn-primary')).trim();
      const esperado = ultimo
        ? 'Ver tabla final'
        : i === EQUIPOS.length - 1
          ? `Empezar la ronda ${ronda + 1}`
          : 'Siguiente equipo';
      check(boton === esperado, `la ronda ${ronda}, turno ${i + 1} ofrece "${esperado}"`);
      await page.click('.sheet__actions .btn-primary');
      await page.waitForTimeout(500);
    }
  }
  check(
    fotos.length === TURNOS && new Set(fotos).size === TURNOS,
    `ninguna foto se repitio en los ${TURNOS} turnos (${new Set(fotos).size} distintas)`
  );

  console.log('Tabla final');
  await page.waitForTimeout(700);
  const tabla = await page.evaluate(() =>
    // La primera tabla es la general; abajo va el detalle ronda por ronda.
    [...document.querySelectorAll('.breakdown:not(.breakdown--sub) tbody tr')].map((tr) => ({
      equipo: tr.querySelector('.team')?.textContent,
      puntos: Number(tr.querySelector('.total')?.textContent.replace(/\D/g, '')),
    }))
  );
  check(tabla.length === EQUIPOS.length, `la tabla lista los ${EQUIPOS.length} equipos (${tabla.length})`);
  check(
    EQUIPOS.every((n) => tabla.some((f) => f.equipo === n)),
    'la tabla nombra a todos los equipos'
  );
  check(
    tabla.every((f, i) => i === 0 || tabla[i - 1].puntos >= f.puntos),
    'la tabla esta ordenada de mayor a menor puntaje'
  );
  check(await page.isVisible('.breakdown td.pos.is-winner'), 'marca al ganador');

  const detalle = await page.evaluate(
    () => document.querySelectorAll('.rounds-detail .breakdown--sub').length
  );
  check(detalle === RONDAS, `el detalle trae una tabla por ronda (${detalle})`);
  check(await page.isVisible('text=Nuevo torneo'), 'ofrece arrancar otro torneo');

  await page.click('text=Nuevo torneo');
  await page.waitForTimeout(500);
  check(await page.isVisible('.stepper--teams'), 'vuelve a la pantalla de armado del torneo');

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
