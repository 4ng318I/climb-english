// MIS PALABRAS: todo lo descubierto, para mirar y escuchar cuando apetezca.
// No puntúa nada ni apunta nada: aquí no hay examen.
import { esc } from '../core/util.js';
import { content, blockWords } from '../core/content.js';
import { state } from '../core/store.js';
import { T, t, tt } from '../core/i18n.js';
import { learnedWords, blockSentences, songKey } from '../core/path.js';
import { header, listenBtn, empty } from '../ui/layout.js';

// Caja 3 o más: ya ha vuelto a salir en varios repasos y la acierta.
const knows = rec => rec.box >= 3;

function row(item, rec, kind = '') {
  const mark = rec ? (knows(rec)
    ? `<span class="w-mark know">⭐ ${esc(t('mark_know'))}</span>`
    : `<span class="w-mark grow">🌱 ${esc(t('mark_grow'))}</span>`) : '';
  return `
    <div class="wrow ${kind}">
      ${listenBtn(item.en)}
      <span class="w-emoji">${esc(item.emoji || '🎵')}</span>
      <div class="w-text">
        <b>${esc(item.en)}</b>
        <span>${esc(item.es)}</span>
        ${item.pron ? `<small>${esc(t('sounds_like'))} <b>${esc(item.pron)}</b></small>` : ''}
      </div>
      ${mark}
    </div>`;
}

export default function words(el) {
  const top = header(T('mywords_title'), '📒');
  if (!learnedWords().length) { el.innerHTML = top + empty('📒', 'empty_first'); return; }

  const sections = content.blocks.map(b => {
    const all = blockWords(b.n);
    const ws = all.filter(w => state.words[w.id]);
    const ss = blockSentences(b.n).filter(s => state.sentences[s.id]);
    if (!ws.length && !ss.length) return '';
    return `
      <div class="panel">
        <h2>${esc(b.emoji)} ${esc(tt(b.title))} <small class="count">${ws.length} ${esc(t('of'))} ${all.length}</small></h2>
        <div class="wlist">
          ${ws.map(w => row(w, state.words[w.id])).join('')}
          ${ss.map(s => row(s, state.sentences[s.id], 'sentence')).join('')}
        </div>
      </div>`;
  }).join('');

  // Palabras de canciones: aparte, porque no cuentan para el camino.
  const songs = content.songs.map(s => {
    const n = Math.min(s.words.length, state.songs[songKey(s)]?.unlocked || 0);
    if (!n) return '';
    return `
      <div class="panel songs-extra">
        <h2>🎵 ${esc(s.title)} <small class="count">${n} ${esc(t('of'))} ${s.words.length}</small></h2>
        <div class="wlist">${s.words.slice(0, n).map(w => row(w, null)).join('')}</div>
      </div>`;
  }).join('');

  el.innerHTML = `${top}
    <section class="stage mywords">
      <p class="howto">${T('mywords_how')}</p>
      <p class="legend-line"><span class="w-mark know">⭐ ${esc(t('mark_know'))}</span> ${T('mark_know_note')}
        &nbsp; <span class="w-mark grow">🌱 ${esc(t('mark_grow'))}</span> ${T('mark_grow_note')}</p>
      ${sections}
      ${songs ? `<h2 class="section-title">🎵 ${T('song_extra_title')}</h2><p class="note">${T('song_extra_note')}</p>${songs}` : ''}
    </section>`;
}
