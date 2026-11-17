// Progreso de la alumna: todo en una sola clave de localStorage.
//
// Todas las apps publicadas en 4ng318i.github.io comparten el mismo origen y, por tanto,
// el mismo localStorage. Por eso TODAS las claves de esta app empiezan por "climbenglish:".
//
// El estado guardado lleva su versión de esquema en "v". Al cargar y al importar se sube
// paso a paso hasta SCHEMA con MIGRATIONS. Hoy no hay ninguna migración, porque la app
// nació con el esquema 1, pero el mecanismo queda listo para cuando cambie el formato.
import { dayKey } from './util.js';

export const APP = 'climbenglish';
export const SCHEMA = 1;
const P = APP + ':';
export const KEY = P + 'progress';

// MIGRATIONS[n] recibe un estado de esquema n y devuelve ese mismo estado en n + 1.
// Ejemplo para una futura v2:
//   1: s => { s.words = renombrarPalabras(s.words); s.v = 2; return s; },
export const MIGRATIONS = {};

const fresh = () => ({
  v: SCHEMA,
  created: dayKey(),
  settings: { name: '', dark: true, mic: false, voice: 'en-GB', rate: 0.85, forceVoice: false },
  words: {},      // id -> { box, learned, due, last, ok, seen, said, written }
  sentences: {},  // id -> { box, learned, due, last, ok, seen }
  grammar: {},    // id -> { seen, plays }
  songs: {},      // id -> { unlocked, day }
  days: [],       // [{ date, newWords, newSentences, wordSessions, sentenceSessions, minutes, grammar }]
  medals: {},     // id -> fecha
  stats: { sessions: 0, silly: 0, said: 0, written: 0 },
  ui: { flipped: {}, stageSeen: 0, rot: 0, lastNew: '', blocksSeen: [] },
  lastVisit: null,
  lastExport: null,
});

export let state = fresh();

// Cómo le fue a la última carga. 'futuro' = progreso de una versión más nueva de la app.
export let status = { state: 'ok', msg: '' };
let blocked = false;

const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};

// Completa los campos que falten (por ejemplo un ajuste nuevo) sin tocar lo que ya hay.
export function normalise(saved) {
  const base = fresh();
  if (!saved || typeof saved !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (saved[k] === undefined || saved[k] === null) continue;
    const isMap = typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null;
    base[k] = isMap ? { ...base[k], ...saved[k] } : saved[k];
  }
  if (!Array.isArray(base.days)) base.days = [];
  base.v = SCHEMA;
  return base;
}

// Sube un estado guardado hasta el esquema actual. Lanza un error si no se puede.
export function migrate(raw, steps = MIGRATIONS, target = SCHEMA) {
  if (!raw || typeof raw !== 'object' || typeof raw.v !== 'number') {
    throw new Error('Esto no tiene el formato del progreso de esta app.');
  }
  if (raw.v > target) {
    const e = new Error(`El progreso viene de una versión más nueva de la app (esquema ${raw.v}; esta entiende hasta el ${target}). Abre la app con internet para actualizarla.`);
    e.futuro = true;
    throw e;
  }
  let s = JSON.parse(JSON.stringify(raw));
  while (s.v < target) {
    const step = steps[s.v];
    if (!step) throw new Error(`Falta la migración del esquema ${s.v} al ${s.v + 1}.`);
    const from = s.v;
    s = step(s);
    if (!s || s.v !== from + 1) throw new Error(`La migración del esquema ${from} al ${from + 1} no ha salido bien.`);
  }
  return normalise(s);
}

export function load() {
  blocked = false;
  status = { state: 'ok', msg: '' };
  const text = ls.get(KEY);
  // Si no hay nada bajo la clave propia se empieza de cero. Un progreso de la primera
  // versión (clave "ingles-a1:v1", sin prefijo) se ignora: no se migra ni se borra.
  if (text == null) return (state = fresh());
  try {
    state = migrate(JSON.parse(text));
  } catch (e) {
    // De una versión más nueva: no se toca, para no estropearlo al volver a esa versión.
    blocked = !!e.futuro;
    status = { state: e.futuro ? 'futuro' : 'ilegible', msg: e.message };
    state = fresh();
  }
  return state;
}

export function save() {
  if (blocked) return;
  ls.set(KEY, JSON.stringify(state));
}

let timer = null;
export function saveSoon() {
  clearTimeout(timer);
  timer = setTimeout(save, 400);
}

// Sustituye el progreso (al importar un archivo). Un import a conciencia levanta el bloqueo.
export function replace(next) {
  state = normalise(next);
  blocked = false;
  status = { state: 'ok', msg: '' };
  save();
}

// Empezar de cero. Se conservan los ajustes del aparato (voz, tema), pero no el nombre:
// así vuelve a salir la bienvenida.
export function reset() {
  const { name, ...device } = state.settings;
  const s = fresh();
  s.settings = { ...s.settings, ...device, name: '' };
  state = s;
  blocked = false;
  status = { state: 'ok', msg: '' };
  save();
}

// Registro del día de hoy (se crea la primera vez que se pide).
export function today() {
  const date = dayKey();
  let d = state.days.find(x => x.date === date);
  if (!d) {
    d = { date, newWords: 0, newSentences: 0, wordSessions: 0, sentenceSessions: 0, minutes: 0, grammar: 0 };
    state.days.push(d);
  }
  return d;
}
