import { defineConfig } from 'vite';

// Base relativa a proposito.
//
// Por defecto Vite emite rutas absolutas ("/assets/index-abc.js"). Eso anda en
// Vercel, donde el sitio vive en la raiz del dominio, pero no en GitHub Pages,
// donde vive en un subdirectorio (usuario.github.io/actosanmartin/): ahi
// "/assets/..." apunta a la raiz del dominio, da 404 y la pagina queda en
// blanco. Con base relativa el mismo build sirve en los dos lados.
export default defineConfig({
  base: './',
});
