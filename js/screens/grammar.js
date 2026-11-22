// TRUCOS: dos clases de descubrimiento, los dos en data/grammar.json.
//
//   kind "regla"  → gramática de verdad (I am / you are, plurales, can…). Pesa más, así que
//                   solo se abre UNA al día.
//   kind "truco"  → cosas que se descubren del inglés sin ser gramática: letras que no
//                   suenan, palabras que se parecen al español, golpes de voz, mayúsculas…
//                   Pesan menos, así que se pueden abrir DOS al día.
//
// Sin tecnicismos: todo el texto vive en los datos, nunca en el código.
import { $, esc, shuffle } from '../core/util.js';
import { content } from '../core/content.js';
import { state, save, today } from '../core/store.js';
import { T, t, tt } from '../core/i18n.js';
import { speak } from '../core/speech.js';
import { currentBlock, checkMedals } from '../core/path.js';
import { go } from '../core/nav.js';
import { header, wordCard, howto } from '../ui/layout.js';
import { bubble, cheer, chime, gentle, pop, confetti } from '../ui/feedback.js';

const tap = (root, sel) => new Promise(resolve => {
  root.onclick = e => { if (e.target.closest(sel)) { root.onclick = null; resolve(); } };
});

const AL_DIA = { regla: 1, truco: 2 };
const clase = g => (g.kind === 'truco' ? 'truco' : 'regla');
const hechosHoy = k => (k === 'truco' ? today().tricks || 0 : today().grammar || 0);

// La siguiente sin ver de cada clase: solo esa se puede abrir.
const siguiente = k => content.grammar.find(g => clase(g) === k && !state.grammar[g.id]);

// Estado de cada ficha: vista, nueva (se puede abrir hoy), dormida (mañana) o por llegar.
function status(rule) {
  if (state.grammar[rule.id]) return 'seen';
  const k = clase(rule);
  if (rule.block > currentBlock().n) return 'locked';
  if (rule !== siguiente(k)) return 'locked';
  return hechosHoy(k) < AL_DIA[k] ? 'new' : 'asleep';
}

function ficha(g) {
  const st = status(g);
  const label = st === 'locked' ? '❔' : esc(tt(g.title));
  const badge = { seen: '✅', new: '✨', asleep: '😴', locked: '🔒' }[st];
  return `<button class="rule-card ${st} ${clase(g)}" data-rule="${esc(g.id)}" data-st="${st}">
    <span class="rc-emoji">${st === 'locked' ? '🎁' : esc(g.emoji)}</span><span class="rc-title">${label}</span><span class="rc-badge">${badge}</span>
  </button>`;
}

function list(el) {
  // Agrupados por bloque: con casi cien fichas, una lista corrida no se puede mirar.
  const porBloque = content.blocks.map(b => {
    const fichas = content.grammar.filter(g => g.block === b.n);
    if (!fichas.length) return '';
    const abiertas = fichas.filter(g => status(g) !== 'locked').length;
    return `<div class="rule-group">
      <h2>${esc(b.emoji)} ${esc(tt(b.title))} <small class="count">${abiertas} ${esc(t('of'))} ${fichas.length}</small></h2>
      <div class="rules">${fichas.map(ficha).join('')}</div>
    </div>`;
  }).join('');
  el.innerHTML = `${header(T('grammar_title'), '📚')}
    <section class="stage rule-list">${howto('grammar_how')}${porBloque}</section>`;
  el.onclick = e => {
    const b = e.target.closest('.rule-card');
    if (!b) return;
    if (b.dataset.st === 'asleep') return bubble(T('grammar_sleep'));
    if (b.dataset.st === 'locked') return bubble(T('grammar_locked'));
    go('grammar', b.dataset.rule);
  };
}

async function show(el, rule) {
  const top = header(esc(tt(rule.title)), esc(rule.emoji));
  const frame = inner => { el.innerHTML = `${top}<section class="stage">${inner}</section>`; };

  // 1. La idea, en cristiano.
  frame(`<div class="idea"><div class="big-emoji">${esc(rule.emoji)}</div><p>${esc(rule.idea)}</p></div>
    <button class="btn next">${T('see_examples')} ➜</button>`);
  await tap(el, '.next');

  // 2. Ejemplos, de uno en uno.
  for (const sc of rule.scenes || []) {
    if (!el.isConnected) return;
    frame(`${wordCard(sc)}<button class="btn next">${T('next')} ➜</button>`);
    speak(sc.en);
    await tap(el, '.next');
  }

  // 3. A jugar: rellenar el hueco de una frase, o contestar una pregunta suelta.
  for (const q of rule.play || []) {
    if (!el.isConnected) return;
    const [before, after = ''] = (q.en || '').split('___');
    frame(`${q.q ? `<p class="howto">${esc(q.q)}</p>` : howto('grammar_fill')}
      ${q.en ? `<div class="gap-line">${esc(before)}<span class="gap" id="gap">❓</span>${esc(after)}</div>` : ''}
      <div class="pic-es">${esc(q.es || '')}</div>
      <div class="options">${shuffle(q.options).map(o =>
        `<button class="tile opt word" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>`);
    await new Promise(next => {
      el.onclick = e => {
        const b = e.target.closest('.opt');
        if (!b || b.disabled) return;
        if (b.dataset.o === q.answer) {
          el.onclick = null;
          b.classList.add('done');
          const hueco = $('#gap', el);
          if (hueco) { hueco.textContent = q.answer; hueco.classList.add('filled'); pop(hueco); }
          chime();
          const frase = (q.en ? q.en.replace('___', q.answer) : q.answer)
            .replace(/[\p{Extended_Pictographic}️]/gu, '');
          speak(frase).then(() => setTimeout(next, 500));
        } else {
          b.disabled = true;
          b.classList.add('faded');
          gentle(T('good_try'), T('try_other'));
        }
      };
    });
  }
  if (!el.isConnected) return;

  const first = !state.grammar[rule.id];
  const rec = state.grammar[rule.id] || (state.grammar[rule.id] = { seen: today().date, plays: 0 });
  rec.plays++;
  if (first) { const d = today(); if (clase(rule) === 'truco') d.tricks = (d.tricks || 0) + 1; else d.grammar++; }
  checkMedals();
  save();
  frame(`<div class="finish"><div class="big-emoji">🧙‍♀️</div><h2>${T('grammar_done')}</h2>
    <div class="row"><button class="btn ghost" data-go="home">🏠 ${T('home')}</button>
    <button class="btn" data-go="grammar">📚 ${T('grammar_title')}</button></div></div>`);
  cheer();
  confetti(24);
}

export default function grammar(el, id) {
  const rule = content.grammar.find(g => g.id === id);
  if (!rule) return list(el);
  const st = status(rule);
  if (st === 'seen' || st === 'new') return show(el, rule);
  return list(el);
}
