// Modo claro u oscuro.
import { state } from './store.js';

export function applyTheme() {
  const dark = !!state.settings.dark;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17132E' : '#FFF6E9');
}
