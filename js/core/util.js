// Utilidades pequeñas compartidas por toda la app.
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const sample = (arr, n) => shuffle(arr).slice(0, n);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// Fechas como 'AAAA-MM-DD' en hora local.
export function dayKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const toDate = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (key, n) => { const d = toDate(key); d.setDate(d.getDate() + n); return dayKey(d); };
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
export const niceDate = key => { const d = toDate(key); return `${d.getDate()}/${d.getMonth() + 1}`; };

// Texto en minúsculas y sin signos, para comparar lo que se dice o escribe.
export const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();

// Palabras con dibujo y traducción distintos (para que un juego no sea ambiguo).
export function distinct(words, n) {
  const seen = new Set(), out = [];
  for (const w of shuffle(words)) {
    if (seen.has(w.emoji) || seen.has(w.es) || seen.has(w.en.toLowerCase())) continue;
    seen.add(w.emoji); seen.add(w.es); seen.add(w.en.toLowerCase());
    out.push(w);
    if (out.length === n) break;
  }
  return out;
}
