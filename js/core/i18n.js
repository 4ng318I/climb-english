// Interfaz que se va pasando al inglés. Cada texto de data/ui-strings.json tiene
// un "from": el porcentaje de inglés a partir del cual se muestra en inglés.
// El porcentaje lo marca la etapa del camino (ver path.js).
import { content } from './content.js';
import { state, saveSoon } from './store.js';
import { englishLevel } from './path.js';
import { esc } from './util.js';

const SUBTITLE_TIMES = 8; // veces que un texto recién cambiado lleva el español debajo

const fill = (txt, vars) => vars ? txt.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : txt;

function entry(key) {
  const s = content.ui[key];
  if (!s) { console.warn('Falta el texto', key); return null; }
  return s;
}

const inEnglish = s => !!s.en && (s.from ?? 100) <= englishLevel();

// Texto plano.
export function t(key, vars) {
  const s = entry(key);
  if (!s) return key;
  return fill(inEnglish(s) ? s.en : s.es, vars);
}

// HTML: igual que t(), pero las primeras veces añade el español en pequeñito.
export function T(key, vars) {
  const s = entry(key);
  if (!s) return esc(key);
  const safe = vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, esc(v)]));
  if (!inEnglish(s)) return fill(esc(s.es), safe);
  const n = state.ui.flipped[key] || 0;
  if (n >= SUBTITLE_TIMES) return fill(esc(s.en), safe);
  state.ui.flipped[key] = n + 1;
  saveSoon();
  return `${fill(esc(s.en), safe)}<small class="sub">${fill(esc(s.es), safe)}</small>`;
}

// Título de algo que viene del contenido con forma { es, en }.
export const tt = (pair, from = 30) => (pair?.en && from <= englishLevel() ? pair.en : pair?.es) ?? '';

// Textos que cambian al pasar de un nivel a otro (para enseñarlos en la celebración).
export function newlyEnglish(before, after) {
  return Object.values(content.ui)
    .filter(s => s && s.en && s.from > before && s.from <= after && s.es.length < 24)
    .slice(0, 4);
}
