// El camino hacia A1: bloques, etapas, medallas y dominio por área.
import { content, blockWords } from './content.js';
import { state } from './store.js';
import { dayKey } from './util.js';

export const learnedWords = () => content.words.filter(w => state.words[w.id]);
export const learnedSentences = () => content.sentences.filter(s => state.sentences[s.id]);

export const blockDone = b => {
  const ws = blockWords(b.n);
  return ws.length > 0 && ws.every(w => state.words[w.id]);
};

// Primer bloque con palabras por descubrir (o el último si ya está todo).
export function currentBlock() {
  return content.blocks.find(b => !blockDone(b)) || content.blocks[content.blocks.length - 1];
}

// Etapas coronadas: todas las palabras de sus bloques ya descubiertas, en orden.
export function stagesDone() {
  let n = 0;
  for (const st of content.stages) {
    const bs = content.blocks.filter(b => b.stage === st.n);
    if (bs.length && bs.every(blockDone)) n++; else break;
  }
  return n;
}

// Etapa en la que está la alumna ahora (la que ya ha celebrado + 1, hasta la última).
export function currentStage() {
  const i = Math.min(state.ui.stageSeen, content.stages.length - 1);
  return content.stages[i];
}

// Porcentaje de interfaz en inglés: lo marca la etapa, no el número de palabras.
export const englishLevel = () => currentStage()?.english ?? 0;

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
    songs: Object.keys(state.songs).length,
  };
}

// Concede las medallas que toquen y devuelve las nuevas.
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

// Dominio por área, de 0 a 100, sobre lo que la alumna ya ha descubierto.
export function domains() {
  const ws = learnedWords();
  const n = ws.length || 1;
  const recs = ws.map(w => state.words[w.id]);
  const unlocked = content.grammar.filter(g => g.block <= currentBlock().n).length || 1;
  const pct = v => Math.round(Math.max(0, Math.min(1, v)) * 100);
  return {
    vocab: pct(recs.reduce((a, r) => a + r.box, 0) / (5 * n)),
    grammar: pct(Object.keys(state.grammar).length / unlocked),
    pron: pct(recs.filter(r => r.said > 0).length / n),
    writing: pct(recs.filter(r => r.written > 0).length / n),
  };
}
