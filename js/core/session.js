// Arma cada sesión de juego: como mucho 3 palabras nuevas O 1 frase nueva,
// más repaso disfrazado de juego. Nunca hay "cola pendiente" a la vista.
import { content } from './content.js';
import { state, today, save } from './store.js';
import { introduce, result, dueIds } from './srs.js';
import { learnedWords, learnedSentences, nextWords, nextSentence, newToday, NEW_WORDS } from './path.js';
import { shuffle } from './util.js';
import match from '../games/match.js';
import intruder from '../games/intruder.js';
import scramble from '../games/scramble.js';
import taps from '../games/taps.js';
import memory from '../games/memory.js';
import silly from '../games/silly.js';

export const GAMES = [match, intruder, scramble, taps, memory, silly];

const REVIEW = 5;           // palabras de repaso por sesión
const GAMES_PER_SESSION = 4;

export function makePlan() {
  // Cada sesión trae 3 palabras nuevas O 1 frase nueva, alternando. Las palabras y las
  // frases tienen cada una su tope diario (ver DAILY en path.js).
  const left = newToday();
  const words = left.words ? nextWords(NEW_WORDS) : [];
  const sentence = left.sentences ? nextSentence() : null;
  let newWords = [], newSentence = null;
  if (sentence && (state.ui.lastNew === 'words' || !words.length)) newSentence = sentence;
  else newWords = words;

  // Repaso: primero lo que toca hoy; si falta, lo que la alumna tiene menos visto.
  const fresh = new Set(newWords.map(w => w.id));
  const review = dueIds(state.words, REVIEW).map(id => content.wordById.get(id)).filter(Boolean);
  if (newSentence) {
    for (const id of newSentence.words) {
      const w = content.wordById.get(id);
      if (w && !review.includes(w) && review.length < REVIEW + 2) review.push(w);
    }
  }
  const need = Math.max(0, 6 - newWords.length - review.length);
  if (need) {
    const rest = shuffle(learnedWords().filter(w => !review.includes(w)))
      .sort((a, b) => state.words[a.id].box - state.words[b.id].box);
    review.push(...rest.slice(0, need));
  }

  const dueS = dueIds(state.sentences, 3).map(id => content.sentenceById.get(id)).filter(Boolean);
  const sentences = [...(newSentence ? [newSentence] : []), ...dueS];
  if (sentences.length < 3) {
    sentences.push(...shuffle(learnedSentences().filter(s => !sentences.includes(s))).slice(0, 3 - sentences.length));
  }

  return { newWords, newSentence, words: [...newWords, ...review], sentences, fresh };
}

// Elige los juegos de la sesión, rotando para que no se repita siempre el mismo orden.
export function pickGames(ctx) {
  const ok = GAMES.filter(g => g.can(ctx));
  if (!ok.length) return [];
  const start = state.ui.rot % ok.length;
  const order = [...ok.slice(start), ...ok.slice(0, start)];
  const chosen = order.slice(0, GAMES_PER_SESSION);
  if (ctx.newSentence && scramble.can(ctx) && !chosen.includes(scramble)) chosen[0] = scramble;
  state.ui.rot = (state.ui.rot + chosen.length) % 60;
  return chosen;
}

export function learnWords(words) {
  const day = today();
  for (const w of words) {
    if (state.words[w.id]) continue;
    introduce(state.words, w.id);
    day.newWords++;
  }
  day.wordSessions = (day.wordSessions || 0) + 1;
  state.ui.lastNew = 'words';
  save();
}

export function learnSentence(s) {
  introduce(state.sentences, s.id);
  const day = today();
  day.sentenceSessions = (day.sentenceSessions || 0) + 1;
  day.newSentences = (day.newSentences || 0) + 1;
  state.ui.lastNew = 'sentence';
  save();
}

// Apunta lo que ha pasado en un juego: [{ id, ok }].
export function record(results) {
  for (const r of results || []) {
    result(state.words[r.id] || state.sentences[r.id], r.ok);
  }
  save();
}
