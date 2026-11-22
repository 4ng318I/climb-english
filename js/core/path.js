// El camino hacia A1: bloques, etapas, requisitos para subir, límites diarios y medallas.
import { content, blockWords } from './content.js';
import { state, today } from './store.js';
import { dayKey } from './util.js';

// Tope diario de material nuevo, contado en palabras y frases (no en sesiones): cada
// sesión trae como mucho 3 palabras nuevas o 1 frase nueva, y se encadenan hasta el tope.
export const DAILY = {
  words: 8,
  // Las frases por día las marca la etapa en data/blocks.json.
  get sentences() { return currentStage()?.sentencesPerDay || 3; },
};
export const NEW_WORDS = 3;

export const learnedWords = () => content.words.filter(w => state.words[w.id]);
export const learnedSentences = () => content.sentences.filter(s => state.sentences[s.id]);
export const blockSentences = n => content.sentences.filter(s => s.block === n);
export const stageBlocks = st => content.blocks.filter(b => b.stage === st.n);

// Un bloque (un agarre del mapa) se completa al descubrir todas sus palabras.
export const blockDone = b => {
  const ws = blockWords(b.n);
  return ws.length > 0 && ws.every(w => state.words[w.id]);
};

// Primer bloque con palabras por descubrir (o el último si ya está todo).
export function currentBlock() {
  return content.blocks.find(b => !blockDone(b)) || content.blocks[content.blocks.length - 1];
}

export function blockProgress(b) {
  const ws = blockWords(b.n), ss = blockSentences(b.n);
  return {
    words: ws.filter(w => state.words[w.id]).length, wordsTotal: ws.length,
    sentences: ss.filter(s => state.sentences[s.id]).length, sentencesTotal: ss.length,
  };
}

const writable = w => /^[a-z]+$/i.test(w.en) && w.en.length > 1;

// Todo lo que cuenta dentro de una etapa, siempre como "llevas X de Y".
export function stageProgress(st) {
  const blocks = stageBlocks(st).map(b => b.n);
  const ws = content.words.filter(w => blocks.includes(w.block));
  const ss = content.sentences.filter(s => blocks.includes(s.block));
  const rules = content.grammar.filter(g => blocks.includes(g.block));
  const canWrite = ws.filter(writable);
  return {
    words: ws.filter(w => state.words[w.id]).length, wordsTotal: ws.length,
    sentences: ss.filter(s => state.sentences[s.id]).length, sentencesTotal: ss.length,
    tricks: rules.filter(g => state.grammar[g.id]).length, tricksTotal: rules.length,
    said: ws.filter(w => state.words[w.id]?.said > 0).length, saidTotal: ws.length,
    written: canWrite.filter(w => state.words[w.id]?.written > 0).length, writtenTotal: canWrite.length,
  };
}

// REQUISITO PARA CORONAR UNA ETAPA: todas las palabras y todas las frases de sus bloques.
export function stageDone(st) {
  const p = stageProgress(st);
  return p.wordsTotal > 0 && p.words === p.wordsTotal && p.sentences === p.sentencesTotal;
}

// Etapas coronadas, en orden.
export function stagesDone() {
  let n = 0;
  for (const st of content.stages) {
    if (stageDone(st)) n++; else break;
  }
  return n;
}

// Etapa en la que está la alumna ahora (la que ya ha celebrado + 1, hasta la última).
export function currentStage() {
  const i = Math.min(state.ui.stageSeen, content.stages.length - 1);
  return content.stages[i];
}
export const atSummit = () => state.ui.stageSeen >= content.stages.length;

// Porcentaje de interfaz en inglés: lo marca la etapa, no el número de palabras.
export const englishLevel = () => currentStage()?.english ?? 0;

// Lo siguiente por descubrir.
export const nextWords = n => content.words.filter(w => !state.words[w.id]).slice(0, n);
export function nextSentence() {
  const limit = currentBlock().n;
  return content.sentences.find(s =>
    !state.sentences[s.id] && s.block <= limit && s.words.every(id => state.words[id])) || null;
}

// Cuánto nuevo queda HOY, en números: { words, sentences }.
export function leftToday() {
  const day = today();
  const cupoPalabras = Math.max(0, DAILY.words - (day.newWords || 0));
  const cupoFrases = Math.max(0, DAILY.sentences - (day.newSentences || 0));
  const words = Math.min(cupoPalabras, content.words.filter(w => !state.words[w.id]).length);
  const pending = content.sentences.filter(s => !state.sentences[s.id]);
  // Frases que hoy pueden salir de verdad: las que ya tienen todas sus palabras, contando
  // también las palabras que aún se pueden descubrir hoy (para no prometer de más).
  const coming = nextWords(words);
  const known = new Set([...Object.keys(state.words), ...coming.map(w => w.id)]);
  const limit = Math.max(currentBlock().n, ...coming.map(w => w.block));
  const ready = pending.filter(s => s.block <= limit && s.words.every(id => known.has(id))).length;
  return { words, sentences: Math.min(cupoFrases, ready) };
}

// ¿Queda algo nuevo que descubrir HOY? (por el límite diario y por lo que quede en el banco)
export function newToday() {
  const day = today();
  return {
    words: (day.newWords || 0) < DAILY.words && nextWords(1).length > 0,
    sentences: (day.newSentences || 0) < DAILY.sentences && !!nextSentence(),
    anythingLeft: nextWords(1).length > 0 || content.sentences.some(s => !state.sentences[s.id]),
  };
}

// Palabras de canciones: son un extra, no cuentan para el camino.
export const songWordCount = () =>
  content.songs.reduce((n, s) => n + Math.min(s.words.length, state.songs[songKey(s)]?.unlocked || 0), 0);
export const songKey = s => s.id || s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function counts() {
  return {
    words: learnedWords().length,
    sentences: learnedSentences().length,
    stages: stagesDone(),
    grammar: Object.keys(state.grammar).length,
    said: state.stats.said,
    written: state.stats.written,
    silly: state.stats.silly,
    sessions: state.stats.sessions,
    blocks: content.blocks.filter(blockDone).length,
    songs: Object.keys(state.songs).length,
  };
}

// Concede las medallas que toquen y devuelve las nuevas.
//
// INVARIANTE: de state.medals no se borra nada, nunca. Una medalla conseguida sigue
// conseguida aunque cambie cómo se cuenta, aunque suba el listón o aunque desaparezca del
// catálogo (en ese caso se sigue viendo en "Mi progreso" como medalla antigua). Perder una
// medalla ya ganada le sentaría peor que cualquier fallo.
export function checkMedals() {
  const c = counts(), fresh = [];
  for (const m of content.medals) {
    if (state.medals[m.id] || !m.rule) continue;
    if ((c[m.rule.type] ?? 0) >= m.rule.value) {
      state.medals[m.id] = dayKey();
      fresh.push(m);
    }
  }
  return fresh;
}
