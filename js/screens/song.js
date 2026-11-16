// CANCIÓN: sin letras. Cada canción es título, artista, enlace al vídeo oficial
// y unas pocas palabras sueltas. Todo sale de data/songs.json.
import { $, esc, dayKey } from '../core/util.js';
import { content } from '../core/content.js';
import { state, save } from '../core/store.js';
import { T } from '../core/i18n.js';
import { checkMedals, songKey as songId } from '../core/path.js';
import { go } from '../core/nav.js';
import { header, wordCard, howto } from '../ui/layout.js';
import { bubble } from '../ui/feedback.js';
import memory from '../games/memory.js';

const PER_DAY = 3; // palabras nuevas de una canción por día (misma regla que al jugar)

const safeUrl = u => (/^https:\/\//i.test(u || '') ? u : '');

function youtubeId(url) {
  const m = /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/.exec(url || '');
  return m ? m[1] : '';
}

function list(el) {
  const songs = content.songs;
  el.innerHTML = `${header(T('song_title'), '🎵')}
    <section class="stage">
      ${songs.length ? howto('song_how') + `<div class="songs">${songs.map(s => `
        <button class="song-card" data-go="song" data-arg="${esc(songId(s))}">
          <span class="sc-emoji">🎧</span>
          <span class="sc-text"><b>${esc(s.title)}</b><small>${esc(s.artist || '')}</small></span>
        </button>`).join('')}</div>` : `<div class="empty"><div class="big-emoji">🎵</div><p>${T('song_empty')}</p></div>`}
    </section>`;
}

function show(el, song) {
  const id = songId(song);
  const total = song.words.length;
  const rec = state.songs[id] || (state.songs[id] = { unlocked: 0, day: '' });
  if (rec.day !== dayKey() && rec.unlocked < total) {
    rec.unlocked = Math.min(total, rec.unlocked + PER_DAY);
    rec.day = dayKey();
  }
  checkMedals();
  save();

  const words = song.words.slice(0, rec.unlocked).map((w, i) => ({ id: `song-${id}-${i}`, emoji: '🎵', pron: '', ...w }));
  const url = safeUrl(song.youtube);
  const vid = youtubeId(url);

  el.innerHTML = `${header(esc(song.title), '🎵')}
    <section class="stage song">
      <p class="artist">${esc(song.artist || '')}</p>
      ${url ? `<div class="video" id="video">
          ${vid ? `<button class="btn" id="watch">▶️ ${T('watch_video')}</button>` : ''}
        </div>
        <a class="plan-b" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${T('video_plan_b')} ↗</a>` : ''}
      ${howto('song_words')}
      <div class="song-words">${words.map(w => wordCard(w)).join('')}</div>
      ${rec.unlocked < total ? `<p class="soon">🎁 ${T('song_more', { n: total - rec.unlocked })}</p>` : ''}
      ${words.length >= 3 ? `<button class="btn" id="game">🃏 ${T('song_game')}</button>` : ''}
      <div id="game-zone" class="game-memory"></div>
    </section>`;

  $('#watch', el)?.addEventListener('click', () => {
    if (!navigator.onLine) return bubble(T('video_offline'));
    // youtube-nocookie: el reproductor no deja cookies hasta que se pulsa play.
    $('#video', el).innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${vid}?rel=0&modestbranding=1&playsinline=1"
      title="${esc(song.title)}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  });

  $('#game', el)?.addEventListener('click', async e => {
    e.currentTarget.hidden = true;
    const zone = $('#game-zone', el);
    zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await memory.play(zone, { words });
    if (el.isConnected) go('song', id);
  });
}

export default function song(el, id) {
  const s = content.songs.find(x => songId(x) === id);
  return s ? show(el, s) : list(el);
}
