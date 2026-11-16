// Navegación entre pantallas mediante el hash de la dirección (#play, #song/happy...).
let render = () => {};
export const setRender = fn => { render = fn; };

export function go(name, arg) {
  const hash = '#' + name + (arg ? '/' + encodeURIComponent(arg) : '');
  if (location.hash === hash) render();
  else location.hash = hash;
}
