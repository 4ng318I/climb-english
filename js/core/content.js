// Carga todo el contenido de la carpeta data/. Nada de contenido en el código.
import { state } from './store.js';
import { setSpoken } from './speech.js';
export const content = {
  stages: [], blocks: [], words: [], sentences: [],
  wordById: new Map(), sentenceById: new Map(), wordByEn: new Map(),
  grammar: [], silly: [], songs: [], ui: {}, medals: [],
};

// Categorías que se entienden con solo ver el dibujo.
const VISUAL = new Set(['nombre', 'acción', 'cualidad', 'número']);
export const isVisual = w => VISUAL.has(w.pos);

async function getJSON(path, fallback) {
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error(path + ' ' + r.status);
    return await r.json();
  } catch (e) {
    if (fallback !== undefined) { console.warn('No se pudo cargar', path, e); return fallback; }
    throw e;
  }
}

// {name} en frases y ejemplos se cambia por el nombre guardado en este dispositivo.
function named(item) {
  const name = state.settings.name || 'Sam';
  for (const k of ['en', 'es', 'pron']) {
    if (typeof item[k] === 'string') item[k] = item[k].replaceAll('{name}', name);
  }
  return item;
}

const slug = s => String(s).toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function loadContent() {
  const index = await getJSON('data/blocks.json');
  content.stages = index.stages;
  content.blocks = index.blocks.slice().sort((a, b) => a.n - b.n);

  const [files, grammar, silly, songs, ui, medals] = await Promise.all([
    Promise.all(content.blocks.map(b => getJSON('data/blocks/' + b.file, { words: [], sentences: [] }))),
    getJSON('data/grammar.json', []),
    getJSON('data/silly.json', []),
    getJSON('data/songs.json', { songs: [] }),
    getJSON('data/ui-strings.json'),
    getJSON('data/medals.json', []),
  ]);

  content.blocks.forEach((b, i) => {
    for (const raw of files[i].words || []) {
      if (!raw.en || !raw.es) { console.warn('Palabra incompleta, se ignora', raw); continue; }
      const w = { pron: '', pos: 'nombre', emoji: '⭐', syllables: 1, stress: 1, ...raw, block: b.n };
      w.id = w.id || 'w-' + slug(w.en);
      if (content.wordById.has(w.id)) { console.warn('Palabra repetida, se ignora', w.id); continue; }
      content.words.push(w);
      content.wordById.set(w.id, w);
      content.wordByEn.set(w.en.toLowerCase(), w);
    }
    for (const raw of files[i].sentences || []) {
      if (!raw.en || !raw.es) { console.warn('Frase incompleta, se ignora', raw); continue; }
      const s = named({ pron: '', emoji: '💬', words: [], ...raw, block: b.n });
      s.id = s.id || 's-' + slug(s.en);
      if (content.sentenceById.has(s.id)) continue;
      s.words = s.words.filter(id => content.wordById.has(id));
      content.sentences.push(s);
      content.sentenceById.set(s.id, s);
    }
  });

  setSpoken(new Map(content.words.filter(w => w.say).map(w => [w.en.toLowerCase(), w.say])));

  content.grammar = grammar.slice().sort((a, b) => a.block - b.block);
  for (const g of content.grammar) [...(g.scenes || []), ...(g.play || [])].forEach(named);
  content.silly = silly;
  content.songs = (songs.songs || []).filter(s => s.title && Array.isArray(s.words));
  content.ui = ui;
  content.medals = medals;
  return content;
}

export const blockWords = n => content.words.filter(w => w.block === n);
