// Arranque de la app: carga progreso y contenido, y pinta la pantalla que toque.
import { $ } from './core/util.js';
import { load, save } from './core/store.js';
import { loadContent } from './core/content.js';
import { initSpeech, speak, stopSpeaking } from './core/speech.js';
import { setRender, go } from './core/nav.js';
import { applyTheme } from './core/theme.js';
import { hideBubble } from './ui/feedback.js';
import home from './screens/home.js';
import play from './screens/play.js';
import pron from './screens/pronunciation.js';
import write from './screens/writing.js';
import grammar from './screens/grammar.js';
import song from './screens/song.js';
import progress from './screens/progress.js';
import settings from './screens/settings.js';
import welcome from './screens/welcome.js';
import { state } from './core/store.js';

const routes = { home, play, pron, write, grammar, song, progress, settings, welcome };

function render() {
  stopSpeaking();
  hideBubble();
  const [name, arg] = location.hash.slice(1).split('/');
  const key = !state.settings.name ? 'welcome' : routes[name] ? name : 'home';
  // Cada pantalla recibe un contenedor nuevo; el anterior queda desconectado
  // y así cualquier juego a medias se detiene solo.
  const view = document.createElement('main');
  view.className = 'screen screen-' + key;
  $('#app').replaceChildren(view);
  window.scrollTo(0, 0);
  Promise.resolve(routes[key](view, arg ? decodeURIComponent(arg) : undefined))
    .catch(err => console.error(err));
}

// Botones comunes a toda la app: ir a una pantalla y escuchar un texto.
document.addEventListener('click', e => {
  const say = e.target.closest('[data-say],[data-say-slow]');
  if (say) {
    speak(say.dataset.say ?? say.dataset.saySlow, { slow: say.dataset.saySlow !== undefined });
    return;
  }
  const nav = e.target.closest('[data-go]');
  if (nav) go(nav.dataset.go, nav.dataset.arg);
});

async function start() {
  load();
  applyTheme();
  initSpeech();
  try {
    await loadContent();
  } catch (err) {
    console.error(err);
    $('#app').innerHTML = `<main class="screen"><div class="empty"><div class="big-emoji">🦎</div>
      <p>No he podido cargar el contenido. Abre la app una vez con internet y vuelve a intentarlo.</p>
      <button class="btn" onclick="location.reload()">Reintentar</button></div></main>`;
    return;
  }
  setRender(render);
  window.addEventListener('hashchange', render);
  render();
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Sin modo offline:', err));
  }
}

start();
