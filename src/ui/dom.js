// Helpers minimos de DOM. Sin framework: el juego tiene 4 pantallas.

/**
 * @param {string} tag  nombre de tag, admite ".clase" y "#id" (ej: 'div.card')
 * @param {object} [props] atributos; `text` y `html` setean contenido
 * @param {Array<Node|string|null|false>} [children]
 */
export function el(tag, props = {}, children = []) {
  const [name, ...classes] = tag.split('.');
  const node = document.createElement(name || 'div');
  if (classes.length) node.className = classes.join(' ');

  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'class') node.className = [node.className, v].filter(Boolean).join(' ');
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else node.setAttribute(k, v);
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

export const fmt = (n) => Number(n).toLocaleString('es-AR');
