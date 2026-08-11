# GeoSanMartín

GeoGuessr argentino: cada ronda muestra la foto de una estatua del General José de
San Martín y hay que elegir en el mapa **en qué provincia está**.

Sin API keys, sin cuentas, sin facturación.

## Cómo jugar

```bash
npm install
npm run dev
```

Se juega como torneo por equipos:

1. En el inicio se elige **cuántos equipos juegan** (de 2 a 12).
2. Cada equipo carga su nombre y juega **una sola ronda**: click sobre una de las 24
   provincias del mapa y confirmar. A cada equipo le toca una estatua distinta.
3. Después de ver dónde estaba la estatua se pasa directo al equipo siguiente. No hay
   pantalla de puntaje por equipo.
4. Cuando jugaron todos aparece la **tabla final** con los equipos ordenados por
   puntaje y el ganador marcado.

**Puntaje**

| | Puntos |
|---|---|
| Provincia correcta | 5.000 |
| Provincia equivocada | hasta 2.500, según lo cerca que quedó |

Errar no es cero: se puntúa por la distancia entre el centro de la provincia elegida y
la estatua real, con el tope de 2.500 para que acertar siempre valga claramente más.
Confundir Río Negro con Neuquén duele mucho menos que mandar la estatua de Ushuaia a
Jujuy.

Hay tres pistas opcionales que descuentan: tipo de monumento (−200), región del país
(−300) y tamaño de la localidad (−500).

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
npm run data:provinces  # Natural Earth -> data/provincias.json (24 provincias, 52 KB)
node scripts/3-build-rounds.mjs --propose   # -> data/curation.json (borrador)
# revisar a ojo cada foto y poner "approved": true en las que sirvan
npm run data:rounds     # descarga fotos -> data/rounds.json + public/photos/
npm run data:validate   # chequea coords, provincia, archivos y atribución
npm test                # tests de puntaje y de provincias
npm run test:e2e        # juega un torneo de tres equipos en un navegador real
```

### `npm run test:e2e`

Levanta `vite preview`, abre un navegador y juega un torneo entero de tres equipos:
verifica que el inicio pida la cantidad de equipos y después el nombre de cada uno, que
el mapa se dibuje con tamaño usable, que clickear una provincia habilite el botón, que el
resultado aparezca, que a cada equipo le toque una estatua distinta, que la tabla final
liste a todos ordenados por puntaje y que no haya errores en consola.

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
  game.js      máquina de estados del torneo, sin DOM
  hints.js     pistas y su costo
  map.js       todo lo que toca Leaflet
  ui/          setup, team, round, result, standings
```

`map.js` concentra todo Leaflet. `provinces.js` existe porque Nominatim devuelve el
mismo lugar con nombres distintos ("Provincia de Misiones", "Ciudad Autónoma de Buenos
Aires"): normaliza todo a códigos ISO 3166-2, y el build falla si una ronda trae una
provincia que no resuelve.

## Créditos y licencias

Fotos de [Wikimedia Commons](https://commons.wikimedia.org) bajo CC BY, CC BY-SA y CC0,
con autor y licencia en `data/rounds.json` y al pie de la pantalla de resultado de cada
ronda. Ubicaciones de [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).
