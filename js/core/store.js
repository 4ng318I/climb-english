// Progreso de la alumna. Todo vive en localStorage, en una sola clave.
import { dayKey } from './util.js';

const KEY = 'ingles-a1:v1';

const fresh = () => ({
  version: 1,
  created: dayKey(),
  settings: { name: '', dark: true, mic: false, voice: 'en-GB', rate: 0.85, forceVoice: false },
  words: {},      // id -> { box, learned, due, last, ok, seen, said, written }
  sentences: {},  // id -> { box, learned, due, last, ok, seen }
  grammar: {},    // id -> { seen, plays }
  songs: {},      // id -> { unlocked, day }
  days: [],       // [{ date, newWords, novelty, minutes, grammar }]
  medals: {},     // id -> fecha
  stats: { sessions: 0, silly: 0, said: 0, written: 0 },
  ui: { flipped: {}, stageSeen: 0, rot: 0, lastNew: '' },
  lastVisit: null,
  lastExport: null,
});

export let state = fresh();

// Mezcla lo guardado sobre un estado nuevo, para que nunca falte un campo.
export function normalise(saved) {
  const base = fresh();
  if (!saved || typeof saved !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (saved[k] === undefined || saved[k] === null) continue;
    const isMap = typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null;
    base[k] = isMap ? { ...base[k], ...saved[k] } : saved[k];
  }
  if (!Array.isArray(base.days)) base.days = [];
  return base;
}

export function load() {
  try { state = normalise(JSON.parse(localStorage.getItem(KEY))); }
  catch { state = fresh(); }
  return state;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sin espacio o modo privado */ }
}

let timer = null;
export function saveSoon() {
  clearTimeout(timer);
  timer = setTimeout(save, 400);
}

export function replace(next) {
  state = normalise(next);
  save();
}

// Registro del día de hoy (se crea la primera vez que se pide).
export function today() {
  const date = dayKey();
  let d = state.days.find(x => x.date === date);
  if (!d) {
    d = { date, newWords: 0, novelty: 0, minutes: 0, grammar: 0 };
    state.days.push(d);
  }
  return d;
}
