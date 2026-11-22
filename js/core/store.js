// Progreso de la alumna: todo en una sola clave de localStorage.
//
// Todas las apps publicadas en 4ng318i.github.io comparten el mismo origen y, por tanto,
// el mismo localStorage. Por eso TODAS las claves de esta app empiezan por "climbenglish:".
//
// El estado guardado lleva su versión de esquema en "v". Al cargar y al importar se sube
// paso a paso hasta SCHEMA con MIGRATIONS.
//
// Red de seguridad (la app se actualiza sola en una tablet que no vamos a tocar):
//   - antes de migrar, importar o borrar se guarda una copia con su fecha;
//   - además se guarda una copia automática el primer arranque de cada día;
//   - se conservan las dos últimas, recuperables desde el rincón de mayores;
//   - lo migrado se escribe y se vuelve a leer para comprobarlo: si no se pudo escribir,
//     el progreso anterior se queda intacto y la app no guarda nada en esa sesión.
import { dayKey } from './util.js';

export const APP = 'climbenglish';
export const SCHEMA = 2;
const P = APP + ':';
export const KEY = P + 'progress';
const COPIA = P + 'backup';
const COPIA_ANTERIOR = P + 'backup-prev';

// Contadores que no existían en el esquema 1. Donde falten, empiezan a contar hoy en cero:
// nunca son un error, y nunca se reescribe nada de lo anterior.
const STATS = () => ({
  sessions: 0, silly: 0, said: 0, written: 0,
  reviews: 0,        // repasos hechos (cada palabra cuenta una vez al día)
  freeGames: 0,      // partidas del rocódromo
  perfect: 0,        // partidas sin ningún tropiezo
  streak: 0,         // racha de aciertos seguidos
  bestStreak: 0,
  games: {},         // id de minijuego -> veces jugado
});

const DIA = date => ({
  date,
  newWords: 0, newSentences: 0, wordSessions: 0, sentenceSessions: 0, minutes: 0, grammar: 0,
  rev: [0, 0],       // repasos del día: [respondidos, acertados a la primera]
  lapses: 0,         // palabras que bajaron de caja
  free: 0,           // partidas del rocódromo
});

const fresh = () => ({
  v: SCHEMA,
  created: dayKey(),
  settings: { name: '', dark: true, mic: false, voice: 'en-GB', rate: 0.85, forceVoice: false },
  words: {},      // id -> { box, learned, due, last, ok, seen, said, written }
  sentences: {},  // id -> { box, learned, due, last, ok, seen }
  grammar: {},    // id -> { seen, plays }
  songs: {},      // id -> { unlocked, day }
  days: [],       // [ DIA(fecha) ]
  medals: {},     // id -> fecha. De aquí NUNCA se quita nada: ver checkMedals en path.js
  stats: STATS(),
  ui: { flipped: {}, stageSeen: 0, rot: 0, lastNew: '', blocksSeen: [] },
  lastVisit: null,
  lastExport: null,
});

export let state = fresh();

// Cómo le fue a la última carga, para avisar en el rincón de mayores.
export let status = { state: 'ok', msg: '' };
let blocked = false;

const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};

// ---------- copias de seguridad ----------

// Guarda el progreso tal y como está AHORA, antes de tocarlo. Se conservan las dos
// últimas copias: la nueva desplaza a la anterior.
export function snapshot(motivo) {
  const texto = ls.get(KEY);
  if (texto == null) return false;
  const previa = ls.get(COPIA);
  if (previa) ls.set(COPIA_ANTERIOR, previa);
  return ls.set(COPIA, JSON.stringify({
    date: dayKey(), at: new Date().toISOString(), motivo, texto,
  }));
}

function leerCopia(clave) {
  const bruto = ls.get(clave);
  if (!bruto) return null;
  try {
    const c = JSON.parse(bruto);
    const prog = JSON.parse(c.texto);
    return {
      clave, date: c.date, at: c.at, motivo: c.motivo || '',
      words: Object.keys(prog.words || {}).length,
      sentences: Object.keys(prog.sentences || {}).length,
      medals: Object.keys(prog.medals || {}).length,
      progress: prog,
    };
  } catch {
    return null;
  }
}

// Copias disponibles, de la más reciente a la más antigua.
export const backups = () => [leerCopia(COPIA), leerCopia(COPIA_ANTERIOR)].filter(Boolean);

// Vuelve a una copia. Antes guarda lo que hay ahora, por si el remedio fuera peor.
export function restoreBackup(clave) {
  const c = backups().find(x => x.clave === clave);
  if (!c) return false;
  snapshot('antes de recuperar una copia');
  state = migrate(c.progress);
  blocked = false;
  status = { state: 'ok', msg: '' };
  return escribirVerificado(state);
}

// ---------- esquema y migraciones ----------

// MIGRATIONS[n] recibe un estado de esquema n y devuelve ese mismo estado en n + 1.
export const MIGRATIONS = {
  // 1 -> 2: aparecen los contadores de repaso, rachas, tropiezos y rocódromo.
  // No hay nada que convertir: lo que falta empieza a contar hoy en cero, y ni las
  // palabras, ni las frases, ni los días, ni las medallas se tocan.
  1: s => {
    s.stats = { ...STATS(), ...(s.stats || {}) };
    s.days = (s.days || []).map(d => ({ ...DIA(d.date), ...d }));
    s.v = 2;
    return s;
  },
};

// Completa los campos que falten sin tocar lo que ya hay.
export function normalise(saved) {
  const base = fresh();
  if (!saved || typeof saved !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (saved[k] === undefined || saved[k] === null) continue;
    const isMap = typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null;
    base[k] = isMap ? { ...base[k], ...saved[k] } : saved[k];
  }
  base.stats = { ...STATS(), ...(saved.stats || {}) };
  base.stats.games = { ...(saved.stats && saved.stats.games) };
  // days es una lista: a los días viejos les faltan los contadores nuevos, que valen cero.
  base.days = (Array.isArray(saved.days) ? saved.days : [])
    .filter(d => d && d.date)
    .map(d => ({ ...DIA(d.date), ...d, rev: Array.isArray(d.rev) ? d.rev : [0, 0] }));
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

// ---------- cargar y guardar ----------

// Escribe y vuelve a leer, para comprobar que se guardó de verdad.
function escribirVerificado(obj) {
  const texto = JSON.stringify(obj);
  if (!ls.set(KEY, texto)) return false;
  return ls.get(KEY) === texto;
}

export function load() {
  blocked = false;
  status = { state: 'ok', msg: '' };
  const text = ls.get(KEY);
  // Sin nada bajo la clave propia se empieza de cero. Un progreso de la primera versión
  // (clave "ingles-a1:v1", sin prefijo) se ignora: ni se migra ni se borra.
  if (text == null) return (state = fresh());

  let raw = null;
  try {
    raw = JSON.parse(text);
  } catch {
    // Ilegible: no se escribe encima, por si se puede rescatar a mano o desde una copia.
    blocked = true;
    status = { state: 'ilegible', msg: 'El progreso guardado no se puede leer. No se ha tocado nada, por si se puede recuperar; abajo tienes las copias automáticas.' };
    return (state = fresh());
  }

  try {
    const hayQueMigrar = raw.v !== SCHEMA;
    if (hayQueMigrar) snapshot(`antes de pasar del formato ${raw.v} al ${SCHEMA}`);
    const migrado = migrate(raw);
    if (hayQueMigrar && !escribirVerificado(migrado)) {
      // No se pudo guardar: se deja el texto anterior donde estaba y no se escribe nada
      // más en esta sesión, pero ella puede jugar con el progreso migrado en memoria.
      ls.set(KEY, text);
      blocked = true;
      status = { state: 'nomigrado', msg: 'No se ha podido guardar el progreso actualizado (¿sin espacio?). El anterior está intacto y esta sesión no guardará cambios.' };
    } else if (hayQueMigrar) {
      status = { state: 'migrado', msg: `Progreso actualizado del formato ${raw.v} al ${SCHEMA}. Antes se guardó una copia.` };
    }
    state = migrado;
  } catch (e) {
    blocked = !!e.futuro;
    status = { state: e.futuro ? 'futuro' : 'ilegible', msg: e.message };
    state = fresh();
  }

  // Copia automática del día: así siempre hay una reciente aunque no pase nada raro.
  const ultima = leerCopia(COPIA);
  if (!blocked && (!ultima || ultima.date !== dayKey())) snapshot('copia automática del día');
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
  snapshot('antes de importar un archivo');
  state = normalise(next);
  blocked = false;
  status = { state: 'ok', msg: '' };
  save();
}

// Empezar de cero. Se conservan los ajustes del aparato (voz, tema), pero no el nombre:
// así vuelve a salir la bienvenida. Antes se guarda una copia, por si fue sin querer.
export function reset() {
  snapshot('antes de borrar el progreso');
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
    d = DIA(date);
    state.days.push(d);
  }
  // Un día que venga del esquema 1 no tiene los contadores nuevos: se completan al vuelo.
  if (!Array.isArray(d.rev)) d.rev = [0, 0];
  if (typeof d.lapses !== 'number') d.lapses = 0;
  if (typeof d.free !== 'number') d.free = 0;
  return d;
}
