// GRAMÁTICA ("trucos"): una regla nueva al día como mucho, con dibujos y ejemplos.
// Sin tecnicismos: todo el texto de las reglas vive en data/grammar.json.
import { $, esc, shuffle } from '../core/util.js';
import { content } from '../core/content.js';
import { state, save, today } from '../core/store.js';
import { T, tt } from '../core/i18n.js';
import { speak } from '../core/speech.js';
import { currentBlock, checkMedals } from '../core/path.js';
import { go } from '../core/nav.js';
import { header, wordCard, howto } from '../ui/layout.js';
import { bubble, cheer, chime, gentle, pop, confetti } from '../ui/feedback.js';

const tap = (root, sel) => new Promise(resolve => {
  root.onclick = e => { if (e.target.closest(sel)) { root.onclick = null; resolve(); } };
});

// Estado de cada regla: vista, nueva (se puede abrir hoy), dormida (mañana) o por llegar.
function status(rule, firstUnseen) {
  if (state.grammar[rule.id]) return 'seen';
  if (rule.block > currentBlock().n) return 'locked';
  if (rule !== firstUnseen) return 'locked';
  return today().grammar < 1 ? 'new' : 'asleep';
}

function list(el) {
  const firstUnseen = content.grammar.find(g => !state.grammar[g.id]);
  const cards = content.grammar.map(g => {
    const st = status(g, firstUnseen);
    const label = st === 'locked' ? '❔' : esc(tt(g.title));
    const badge = { seen: '✅', new: '✨', asleep: '😴', locked: '🔒' }[st];
    return `<button class="rule-card ${st}" data-rule="${esc(g.id)}" data-st="${st}">
      <span class="rc-emoji">${st === 'locked' ? '🎁' : esc(g.emoji)}</span><span class="rc-title">${label}</span><span class="rc-badge">${badge}</span>
    </button>`;
  }).join('');
  el.innerHTML = `${header(T('grammar_title'), '📚')}
    <section class="stage">${howto('grammar_how')}<div class="rules">${cards}</div></section>`;
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

  // 3. A jugar con la regla: elegir la pieza que falta.
  for (const q of rule.play || []) {
    if (!el.isConnected) return;
    const [before, after = ''] = q.en.split('___');
    frame(`${howto('grammar_fill')}
      <div class="gap-line">${esc(before)}<span class="gap" id="gap">❓</span>${esc(after)}</div>
      <div class="pic-es">${esc(q.es)}</div>
      <div class="options">${shuffle(q.options).map(o =>
        `<button class="tile opt word" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>`);
    await new Promise(next => {
      el.onclick = e => {
        const b = e.target.closest('.opt');
        if (!b || b.disabled) return;
        if (b.dataset.o === q.answer) {
          el.onclick = null;
          b.classList.add('done');
          $('#gap', el).textContent = q.answer;
          $('#gap', el).classList.add('filled');
          pop($('#gap', el));
          chime();
          speak(q.en.replace('___', q.answer).replace(/[\p{Extended_Pictographic}️]/gu, '')).then(() => setTimeout(next, 500));
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
  if (first) today().grammar++;
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
  const firstUnseen = content.grammar.find(g => !state.grammar[g.id]);
  const st = status(rule, firstUnseen);
  if (st === 'seen' || st === 'new') return show(el, rule);
  return list(el);
}
