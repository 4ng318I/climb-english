// Ánimos, confeti y sonidos. Aquí no existe "está mal": siempre se empieza por
// lo que salió bien y luego se enseña cómo queda todavía mejor.
import { $, pick } from '../core/util.js';
import { T } from '../core/i18n.js';

let audio = null;
export function blip(freq = 520, dur = 0.1) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.16, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + dur);
  } catch { /* sin sonido, no pasa nada */ }
}
export function chime() {
  blip(660, 0.12);
  setTimeout(() => blip(880, 0.2), 110);
}

const PARTY = ['⭐', '🎉', '✨', '🎵', '🧗', '💖', '🎨', '🌈'];
export function confetti(n = 18) {
  const fx = $('#fx');
  if (!fx || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'conf';
    s.textContent = pick(PARTY);
    s.style.left = Math.random() * 100 + '%';
    s.style.animationDelay = Math.random() * 0.4 + 's';
    s.style.fontSize = 22 + Math.random() * 22 + 'px';
    fx.appendChild(s);
    setTimeout(() => s.remove(), 2200);
  }
}

let timer = null;
export function bubble(html, ms = 2600) {
  const b = $('#bubble');
  if (!b) return;
  b.innerHTML = `<span class="mascot">🦎</span><div>${html}</div>`;
  b.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => b.classList.remove('show'), ms);
}
export function hideBubble() {
  clearTimeout(timer);
  $('#bubble')?.classList.remove('show');
}

export const praise = () => T(pick(['great', 'super', 'wow', 'yeah']));

export function cheer() {
  chime();
  confetti();
  bubble(`<b>${praise()}</b>`, 1600);
}

// Primero lo bueno, después la pista para que salga todavía mejor.
export function gentle(goodHtml, betterHtml) {
  bubble(`<b>${goodHtml}</b><br>${betterHtml}`, 3800);
}

function animate(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
export const pop = el => animate(el, 'pop');
export const wobble = el => animate(el, 'wobble');
