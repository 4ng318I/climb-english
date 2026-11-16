// Voz: leer en alto (SpeechSynthesis) y escuchar a la alumna (SpeechRecognition).
// La voz es la referencia de pronunciación; todo tiene plan B si algo falla.
import { state } from './store.js';
import { norm } from './util.js';

const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
let voices = [];
const refresh = () => { voices = synth ? synth.getVoices() : []; };

export function initSpeech() {
  if (!synth) return;
  refresh();
  if ('onvoiceschanged' in synth) synth.onvoiceschanged = refresh;
}

const langOf = v => v.lang.replace('_', '-');

function voice() {
  const en = voices.filter(v => /^en[-_]/i.test(v.lang));
  const pref = state.settings.voice;
  return en.find(v => langOf(v) === pref)
    || en.find(v => /en-GB/i.test(langOf(v)))
    || en.find(v => /en-US/i.test(langOf(v)))
    || en[0] || null;
}

export const canSpeak = () => !!synth;
export const englishVoiceName = () => voice()?.name || '';

export function stopSpeaking() { try { synth?.cancel(); } catch { /* nada */ } }

// Lee un texto en inglés. Devuelve una promesa que se cumple al terminar.
export function speak(text, { slow = false } = {}) {
  return new Promise(resolve => {
    if (!synth || !text) return resolve(false);
    let done = false;
    const fin = ok => { if (!done) { done = true; resolve(ok); } };
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = voice();
      if (v) u.voice = v;
      u.lang = v ? langOf(v) : state.settings.voice;
      u.rate = slow ? 0.55 : (state.settings.rate || 0.85);
      u.onend = () => fin(true);
      u.onerror = () => fin(false);
      synth.speak(u);
      setTimeout(() => fin(false), 2500 + text.length * 220);
    } catch { fin(false); }
  });
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const micSupported = () => !!SR;
export const micReady = () => !!SR && !!state.settings.mic && navigator.onLine;

// Escucha una vez. Devuelve lo que ha entendido (lista de posibilidades) o null si no pudo.
export function listen(ms = 6000) {
  return new Promise(resolve => {
    if (!SR) return resolve(null);
    let done = false;
    const fin = v => { if (!done) { done = true; resolve(v); } };
    try {
      const r = new SR();
      r.lang = state.settings.voice;
      r.maxAlternatives = 5;
      r.interimResults = false;
      r.onresult = e => fin([...e.results[0]].map(a => a.transcript));
      r.onerror = () => fin(null);
      r.onend = () => setTimeout(() => fin(null), 300);
      r.start();
      setTimeout(() => { try { r.stop(); } catch { /* nada */ } }, ms);
      setTimeout(() => fin(null), ms + 1500);
    } catch { fin(null); }
  });
}

function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// ¿Lo que se ha oído se parece a lo que tocaba decir? Generoso a propósito.
export function soundsLike(target, heard) {
  const goal = norm(target);
  const slack = goal.length <= 3 ? 0 : goal.length <= 7 ? 1 : 2;
  return (heard || []).some(h => {
    const x = norm(h);
    return x === goal || x.split(' ').includes(goal) || distance(x, goal) <= slack;
  });
}
