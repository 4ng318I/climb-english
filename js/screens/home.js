// Panel principal. El botón de jugar es el más grande, con diferencia.
import { $, pick, dayKey, daysBetween } from '../core/util.js';
import { state, save } from '../core/store.js';
import { T, t, tt } from '../core/i18n.js';
import { currentStage, learnedWords } from '../core/path.js';
import { go } from '../core/nav.js';
import { applyTheme } from '../core/theme.js';
import { bubble } from '../ui/feedback.js';
import { voiceBlocked } from '../core/speech.js';

const TILES = [
  ['pron', '🗣️', 'pron_title'],
  ['write', '✍️', 'write_title'],
  ['grammar', '📚', 'grammar_title'],
  ['song', '🎵', 'song_title'],
  ['progress', '📊', 'progress_title'],
];

export default function home(el) {
  const name = state.settings.name;
  const now = dayKey();
  const firstEver = !state.lastVisit;
  const away = state.lastVisit ? daysBetween(state.lastVisit, now) : 0;
  // Si lleva días sin entrar se la recibe con alegría, sin contadores ni reproches.
  const hello = firstEver ? 'hello_first' : away >= 3 ? 'hello_back' : pick(['hello_1', 'hello_2', 'hello_3']);
  state.lastVisit = now;
  save();

  const stage = currentStage();
  const n = learnedWords().length;
  el.innerHTML = `
    <header class="home-top">
      <div class="hello"><span class="mascot big">🦎</span><div class="speech">${T(hello, { name })}</div></div>
      <button class="round" id="dark" aria-label="Modo oscuro">${state.settings.dark ? '☀️' : '🌙'}</button>
    </header>
    <div class="alert" id="voice-alert" hidden>🔇 ${t('voice_missing')}</div>
    <button class="play-big" data-go="play">
      <span class="pb-emoji">🎮</span><span class="pb-text">${T('play_title')}</span>
    </button>
    <nav class="tiles">${TILES.map(([route, emoji, key], i) => `
      <button class="home-tile t${i + 1}" data-go="${route}"><span class="ht-emoji">${emoji}</span><span>${T(key)}</span></button>`).join('')}
    </nav>
    <footer class="home-foot">
      <span class="where">${stage.emoji} ${tt(stage.name)}${n ? ` · ${n} ${t('words')}` : ''}</span>
      <button class="grown" id="grown">👨‍👩‍👧 ${t('grownups')}</button>
    </footer>`;

  // Las voces llegan con retraso: se comprueba ahora y cuando el navegador avise.
  const checkVoice = () => {
    if (!el.isConnected) return window.removeEventListener('voices-ready', checkVoice);
    $('#voice-alert', el).hidden = !voiceBlocked();
  };
  checkVoice();
  window.addEventListener('voices-ready', checkVoice);

  $('#dark', el).onclick = () => {
    state.settings.dark = !state.settings.dark;
    save();
    applyTheme();
    $('#dark', el).textContent = state.settings.dark ? '☀️' : '🌙';
  };

  // Rincón de mayores: hay que mantener pulsado, para que la alumna no entre sin querer.
  const grown = $('#grown', el);
  let hold = null;
  const cancel = () => { clearTimeout(hold); hold = null; grown.classList.remove('holding'); };
  grown.onpointerdown = () => {
    grown.classList.add('holding');
    hold = setTimeout(() => { cancel(); go('settings'); }, 1500);
  };
  grown.onpointerup = () => { if (hold) bubble(t('grownups_hold')); cancel(); };
  grown.onpointerleave = cancel;
  grown.oncontextmenu = e => e.preventDefault();
}
