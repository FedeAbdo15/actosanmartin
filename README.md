# GeoSanMartín

GeoGuessr argentino: en cada turno se ve la foto de una estatua del General José de
San Martín y hay que elegir en el mapa **en qué provincia está**.

Sin API keys, sin cuentas, sin facturación.

## Cómo jugar

```bash
npm install
npm run dev
```

Se juega como torneo por equipos:

1. En el inicio se cargan **los nombres de todos los equipos** (de 2 a 6) y **cuántas
   rondas** se juegan. El que quede sin nombre juega como "Equipo N".
2. **Cada ronda es una vuelta completa**: juegan todos los equipos, uno por turno, y
   recién ahí empieza la vuelta siguiente. El turno es click sobre una de las 24
   provincias del mapa y confirmar.
3. **Ninguna estatua se repite** en todo el torneo: el mazo se baraja y se reparte
   entero al empezar. Por eso el tope de rondas depende de cuántos equipos haya —con 15
   estatuas y 4 equipos entran 3 rondas— y el selector no deja pasarse.
4. Después de ver dónde estaba la estatua se pasa directo al equipo siguiente. No hay
   pantalla de puntaje por equipo.
5. Cuando terminan todas las vueltas aparece la **tabla final**: aciertos, promedio por
   ronda y total acumulado, con el ganador marcado y el detalle ronda por ronda.

**Puntaje**

| | Puntos |
|---|---|
| Provincia correcta | 5.000 |
| Provincia equivocada | hasta 2.500, según lo cerca que quedó |

Errar no es cero: se puntúa por la distancia entre el centro de la provincia elegida y
la estatua real, con el tope de 2.500 para que acertar siempre valga claramente más.
Confundir Río Negro con Neuquén duele mucho menos que mandar la estatua de Ushuaia a
Jujuy.

Hay dos pistas opcionales que descuentan: **región del país** (−300) y **habitantes de la
provincia** (−500). La segunda da un rango ("Entre 1 y 2 millones de habitantes"), no el
número exacto: el número se busca en el celular y regala la respuesta, el rango deja
cuatro o cinco provincias posibles. Los datos son del censo 2022, vía Wikidata, y viajan
en `data/provincias.json` junto con la geometría.

El mapa de provincias no usa tiles: son 24 polígonos dibujados desde un GeoJSON de
52 KB que viaja en el bundle, así que la pantalla de juego anda sin internet. El mapa
del resultado sí usa tiles de OpenStreetMap para mostrar el punto exacto.

## Estado del contenido

**15 rondas verificadas** en 9 provincias: Salta (Cachi, Tartagal), Jujuy, Formosa,
Corrientes (Goya), Córdoba (capital, Río Cuarto), Mendoza, La Pampa (Eduardo Castex),
Neuquén (San Martín de los Andes) y Buenos Aires (Tandil, Azul, Quilmes, Tornquist,
Mar de Ajó).

Son menos de las ~40 previstas, y la razón está medida, no estimada: Wikimedia Commons
no tiene fotos identificables y bien ubicadas de estatuas de San Martín para más
localidades argentinas. Ver [Por qué 15 y no 40](#por-qué-15-y-no-40).

`data/statues.raw.json` guarda las **213 ubicaciones** de estatuas relevadas en todo el
país (de Ushuaia a La Quiaca). Están listas para cuando aparezcan más fotos.

## Regenerar los datos

El pipeline es reproducible y cachea en disco, así que se puede cortar y retomar.

```bash
npm run data:osm        # Overpass -> data/statues.raw.json (213 estatuas)
npm run data:photos     # Nominatim + Commons -> data/candidates.json (~10 min, 1 req/s)
npm run data:provinces  # Natural Earth + Wikidata -> data/provincias.json (geometría y
                        #   población de las 24 provincias, 53 KB)
node scripts/3-build-rounds.mjs --propose   # -> data/curation.json (borrador)
# revisar a ojo cada foto y poner "approved": true en las que sirvan
npm run data:rounds     # descarga fotos -> data/rounds.json + public/photos/
npm run data:validate   # chequea coords, provincia, archivos y atribución
npm test                # tests de puntaje, provincias y torneo
npm run test:e2e        # juega un torneo de tres equipos en un navegador real
```

### `npm run test:e2e`

Levanta `vite preview`, abre un navegador y juega un torneo entero de tres equipos a dos
rondas (seis turnos): verifica que el inicio pida los nombres de todos los equipos y la
cantidad de rondas, que entre turnos ya no se pida nada, que el mapa se dibuje con tamaño
usable, que clickear una provincia habilite el botón, que el resultado aparezca, que las
seis fotos sean distintas, que la tabla final liste a todos ordenados por puntaje con el
detalle por ronda y que no haya errores en consola.

## Publicar

El juego es estático: alcanza con servir `dist/` después de `npm run build`.

`vite.config.js` usa `base: './'`, así que el mismo build anda tanto en la raíz de un
dominio (Vercel, Netlify) como en un subdirectorio (GitHub Pages, que sirve en
`usuario.github.io/repo/`). Las fotos de `public/` se resuelven con
[`src/assets.js`](src/assets.js) por el mismo motivo: `rounds.json` las guarda como
`/photos/x.jpg` y Vite no reescribe strings adentro de un JSON.

**GitHub Pages.** Lo publica [`.github/workflows/pages.yml`](.github/workflows/pages.yml),
que compila en cada push a `master` y sube `dist/`. En **Settings → Pages**, Source tiene
que estar en "GitHub Actions".

El paso que hay que compilar es justamente el que se pasa por alto: la plantilla
"Static HTML" que ofrece GitHub (`static.yml`) sube el repo entero con `path: '.'`, sin
build. Así lo que se publica es el `index.html` del código fuente, que apunta a
`/src/main.js` — un archivo que sin compilar no existe, y que aunque existiera no correría
en el navegador porque importa `leaflet` por nombre. La página queda en blanco.

Existe porque los tests unitarios pasaban en verde mientras el juego estaba roto. Dos
bugs que solo se ven en un navegador:

1. **Leaflet se construía sobre un nodo todavía desprendido del DOM.** Medía 0×0,
   `fitBounds` daba `NaN` y el mapa nunca aparecía. Ahora los componentes exponen un
   `__mount` que `main.js` llama recién después de insertar el árbol.
2. **`setGuess()` emitía un evento que redibujaba la pantalla entera**, destruyendo el
   mapa y el botón apenas se elegía una provincia. Los cambios dentro de una misma fase
   ya no emiten; solo lo hacen las transiciones (`start`, `submitGuess`, `next`).

Los scripts mandan un `User-Agent` descriptivo y van a 1 request/segundo: Wikimedia y
Nominatim devuelven 429 sin eso.

### Cómo agregar una ronda

1. `node scripts/3-build-rounds.mjs --propose` regenera `data/curation.json`.
2. Abrir cada candidato en Commons y aplicar los criterios de abajo.
3. Marcar `"approved": true` y correr `npm run data:rounds`.

**Criterios de curación** (salieron de rechazar 13 candidatos en la primera tanda):

- La estatua tiene que **verse**. Se rechazaron fotos de plazas donde el monumento era
  un punto lejano, y una que era solo un cartel de "Plaza San Martín".
- La foto **no puede llevar el nombre del lugar impreso**. Varias postales viejas traían
  el epígrafe ("NEUQUEN - AV. ARGENTINA Y MONUMENTO AL GRAL. SAN MARTIN") y regalaban
  la respuesta.
- **Toma abierta** con plaza, edificios o cerros visibles. Un primer plano de un busto
  no da ninguna señal geográfica.
- **Ciudad correcta**: el buscador asignó monumentos de Ciudad de México, Bilbao y
  Villa Mercedes (San Luis) a ciudades argentinas homónimas.
- **Sujeto correcto**: aparecieron monumentos a Malvinas, Artigas, Fructuoso Rivera,
  Facundo Quiroga, el Indio Tehuelche y hasta a Ceferino Namuncurá.
- Sin andamios ni restauración (la de Rosario estaba tapada), ni nocturnas donde la
  estatua queda en silueta.

## Por qué 15 y no 40

El plan apuntaba a ~40 rondas. Al curar se midió la precisión real de la búsqueda y no
daba. Los números:

| Fuente | Resultado |
|---|---|
| Estatuas de San Martín en OSM (Argentina) | **213** con coordenadas |
| Con foto en el tag `image` de OSM | 10 |
| Ítems argentinos en Wikidata con imagen (`P18`) | 8 |
| Commons *geosearch* (muestra de 30 puntos, radio 300 m) | **0 matches** |
| Commons búsqueda libre por ciudad | ~20% de precisión (PDFs de libros españoles del s. XIX, monumentos de otros países) |
| Commons con `intitle:` + `filetype:bitmap` | 84 candidatos plausibles |
| Tras revisión visual de los 28 mejores | **15 usables** |
| Segunda pasada sobre candidatos alternativos | 31 revisados, **1 rescatado** (Tartagal) |

La segunda pasada es la que cierra el tema: de 31 candidatos que pasaban el filtro
estricto de título, 30 eran monumentos a otra persona o estaban en otro país.

Para llegar a las 213 ubicaciones haría falta otra fuente de imágenes — Google Street
View cubriría la mayoría, a cambio de una API key y una cuenta de facturación.

## Arquitectura

```
data/          statues.raw.json (213 pts) · candidates.json · curation.json
               rounds.json (las 15 jugables) · provincias.json (geometría)
public/photos/ imágenes descargadas de Commons
scripts/       1-fetch-osm · 2-find-photos · 3-build-rounds · 4-fetch-provinces · validate
src/
  scoring.js   puntaje por provincia + haversine (con tests)
  provinces.js las 24 jurisdicciones y sus alias
  game.js      máquina de estados del torneo, sin DOM (con tests)
  hints.js     pistas y su costo (con tests)
  regions.js   provincias agrupadas en regiones
  map.js       todo lo que toca Leaflet
  ui/          setup, turn, round, result, standings
```

`regions.js` está separado de `hints.js` por una razón de build: `hints.js` importa el
GeoJSON de provincias (de ahí saca la población) y eso solo lo resuelve el bundler,
mientras que `3-build-rounds.mjs` corre en Node pelado y necesita las regiones.

Las fases son `setup → turn → playing → revealed → …  → standings`: `turn` solo anuncia
a quién le toca (los nombres ya se cargaron en `setup`) y sirve de corte para pasar la
computadora. El reparto de estatuas se arma completo en `start()`, no turno a turno: es
lo que garantiza que ninguna foto se repita.

`map.js` concentra todo Leaflet. `provinces.js` existe porque Nominatim devuelve el
mismo lugar con nombres distintos ("Provincia de Misiones", "Ciudad Autónoma de Buenos
Aires"): normaliza todo a códigos ISO 3166-2, y el build falla si una ronda trae una
provincia que no resuelve.

## Créditos y licencias

Un juego de **Informática — ORT**. El logo está en
[`public/logo-info.png`](public/logo-info.png) (192×192) y lo maneja
[`src/ui/brand.js`](src/ui/brand.js), que lo pone en tres lugares:

- **Marca de agua** fija abajo a la izquierda, en todas las pantallas. Se monta una sola
  vez colgada del `body` y no de `#app`, que se redibuja entero en cada cambio de fase.
  Va con `z-index` por encima de la hoja de resultado para verse también ahí; el
  contenedor lleva `pointer-events: none` y el link `pointer-events: auto`, así solo el
  logo es clickeable y el resto de la esquina le sigue llegando a la foto y al mapa.
- **Logo grande** encabezando el inicio y cada turno.
- **Favicon** y `apple-touch-icon`, con ruta relativa para que ande igual en la raíz de un
  dominio que en el subdirectorio de GitHub Pages.

Los dos logos son un link al
[campus de Informática](https://campus.ort.edu.ar/secundaria/almagro/informatica), siempre
en pestaña nueva: el torneo vive en memoria y navegar en la misma pestaña perdería la
partida en curso. La firma escrita ("Un juego de Informática · ORT") va además en el
inicio y en la tabla final.

Fotos de [Wikimedia Commons](https://commons.wikimedia.org) bajo CC BY, CC BY-SA y CC0,
con autor y licencia en `data/rounds.json` y al pie de la pantalla de resultado de cada
ronda. Ubicaciones de [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).
