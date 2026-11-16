// Piezas de pantalla que se repiten: cabecera, botones de escuchar y tarjeta de palabra.
import { esc } from '../core/util.js';
import { T } from '../core/i18n.js';
import { state } from '../core/store.js';
import { isVisual } from '../core/content.js';

export const header = (titleHtml, emoji = '') => `
  <header class="bar">
    <button class="round" data-go="home" aria-label="Inicio">🏠</button>
    <h1>${emoji ? `<span class="bar-emoji">${emoji}</span> ` : ''}${titleHtml}</h1>
  </header>`;

// Los botones con data-say los atiende app.js: leen el texto en voz alta.
export const listenBtn = (text, big = false) =>
  `<button class="listen${big ? ' big' : ''}" data-say="${esc(text)}" aria-label="Escuchar">🔊</button>`;
export const slowBtn = text =>
  `<button class="listen slow" data-say-slow="${esc(text)}" aria-label="Escuchar despacio">🐢</button>`;

// La grafía española es solo una ayuda visual: siempre "suena parecido a", nunca "se dice".
export const soundsLike = pron => pron
  ? `<div class="pron">${T('sounds_like')} <b>${esc(pron)}</b></div>` : '';

// Tarjeta de palabra o frase. Escuchar va primero y es lo más grande.
export function wordCard(item, { tag = '' } = {}) {
  return `
    <div class="wcard">
      ${tag ? `<div class="tag">${tag}</div>` : ''}
      <div class="listen-row">${listenBtn(item.en, true)}${slowBtn(item.en)}</div>
      <div class="en"><span class="wemoji">${esc(item.emoji || '')}</span> ${esc(item.en)}</div>
      <div class="es">${esc(item.es)}</div>
      ${soundsLike(item.pron)}
    </div>`;
}

// Dibujo de una palabra. El español acompaña mientras la palabra es reciente
// o cuando el dibujo solo no basta para entenderla.
export function pic(w, forceCaption = false) {
  const rec = state.words[w.id];
  const caption = forceCaption || !isVisual(w) || !rec || rec.box <= 2;
  return `<span class="pic-emoji">${esc(w.emoji)}</span>${caption ? `<span class="pic-es">${esc(w.es)}</span>` : ''}`;
}

export const howto = (key, vars) => `<p class="howto">${T(key, vars)}</p>`;

export const empty = (emoji, key) => `
  <div class="empty">
    <div class="big-emoji">${emoji}</div>
    <p>${T(key)}</p>
    <button class="btn" data-go="play">🎮 ${T('play')}</button>
  </div>`;
