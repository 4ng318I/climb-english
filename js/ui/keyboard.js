// Teclado grande en pantalla, para no depender del teclado de Android.
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

export function keyboard() {
  return `<div class="keyboard">${ROWS.map((row, i) => `
    <div class="krow">${[...row].map(k => `<button class="key" data-key="${k}">${k}</button>`).join('')}${
      i === 2 ? '<button class="key wide" data-key="back" aria-label="Borrar">⌫</button>' : ''}</div>`).join('')}</div>`;
}
