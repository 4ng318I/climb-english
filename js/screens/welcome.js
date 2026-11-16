// Primera vez: la mascota pregunta el nombre. Se guarda solo en este dispositivo
// (el repositorio público no contiene el nombre de nadie).
import { $ } from '../core/util.js';
import { state, save } from '../core/store.js';
import { t } from '../core/i18n.js';
import { bubble } from '../ui/feedback.js';

export const cleanName = raw => String(raw ?? '').replace(/[{}<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);

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
    // Se recarga para que las frases de ejemplo salgan ya con su nombre.
    location.hash = '#home';
    location.reload();
  };
}
