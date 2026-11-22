// Primera vez: la mascota pregunta el nombre. Se guarda solo en este dispositivo
// (el repositorio público no contiene el nombre de nadie).
import { $, esc } from '../core/util.js';
import { DAILY } from '../core/path.js';
import { state, save } from '../core/store.js';
import { T, t } from '../core/i18n.js';
import { header } from '../ui/layout.js';
import { todayLine } from '../ui/nextstep.js';
import { bubble } from '../ui/feedback.js';

export const cleanName = raw => String(raw ?? '').replace(/[{}<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);

// El truco del ritmo, con sus palabras. Se usa en la bienvenida y en la pantalla
// "¿Por qué solo unas pocas al día?", a la que puede volver cuando quiera desde el panel.
function rhythm(introKey, extra = '') {
  const n = { name: state.settings.name, words: DAILY.words, sentences: DAILY.sentences };
  return `
      <div class="rhythm">
        <p><b>${esc(t(introKey, n))}</b></p>
        <p>🌱 ${esc(t('rhythm_little', n))}</p>
        <p>🎮 ${esc(t('rhythm_play', n))}</p>
        ${extra}
        <p>🌅 ${esc(t('rhythm_tomorrow', n))}</p>
      </div>`;
}

export function why(el) {
  const today = todayLine();
  el.innerHTML = `${header(esc(t('why_button')), '🦎')}
    <section class="stage welcome">
      ${rhythm('why_hi', `<p>💛 ${esc(t('why_ok'))}</p>`)}
      ${today ? `<p class="next-line today">📅 ${today}</p>` : ''}
      <div class="row">
        <button class="btn ghost" data-go="words">📒 ${T('mywords_title')}</button>
        <button class="btn" data-go="play">🎮 ${T('play')}</button>
      </div>
    </section>`;
}

// Segundo paso de la bienvenida: el ritmo, contado antes de que se tope con el límite.
function explain(el) {
  el.innerHTML = `
    <section class="stage welcome">
      <div class="big-emoji">🦎</div>
      ${rhythm('rhythm_hi')}
      <button class="btn" id="go">🧗 ${esc(t('rhythm_go'))}</button>
    </section>`;
  $('#go', el).onclick = () => {
    // Se recarga para que las frases de ejemplo salgan ya con su nombre.
    location.hash = '#home';
    location.reload();
  };
}

export default function welcome(el) {
  el.innerHTML = `
    <section class="stage welcome">
      <img class="logo" src="assets/icon-192.png" alt="" width="120" height="120">
      <div class="hello"><span class="mascot big">🦎</span><div class="speech">${t('welcome_hi')}</div></div>
      <form id="who-form" class="who">
        <input id="who" type="text" maxlength="16" autocomplete="off" autocapitalize="words" spellcheck="false"
          enterkeyhint="go" aria-label="${t('welcome_label')}">
        <button class="btn" id="start" type="submit">🧗 ${t('welcome_go')}</button>
      </form>
    </section>`;
  $('#who-form', el).onsubmit = e => {
    e.preventDefault();
    const name = cleanName($('#who', el).value);
    if (!name) { bubble(t('welcome_empty')); $('#who', el).focus(); return; }
    state.settings.name = name.charAt(0).toUpperCase() + name.slice(1);
    save();
    explain(el);
  };
}
