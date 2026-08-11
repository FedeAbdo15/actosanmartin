// Rutas de public/ resueltas contra la base del deploy.
//
// rounds.json guarda las fotos como "/photos/x.jpg". Vite reescribe las rutas
// que ve en el HTML, el CSS y los imports, pero no los strings adentro de un
// JSON: ese "/" inicial apunta a la raiz del dominio, que en GitHub Pages es
// usuario.github.io y no el subdirectorio del repo. La base se aplica a mano.

/**
 * @param {string} path ruta dentro de public/, con o sin barra inicial
 * @returns {string} ruta lista para usar como src
 */
export function asset(path) {
  return `${import.meta.env.BASE_URL}${String(path).replace(/^\/+/, '')}`;
}
