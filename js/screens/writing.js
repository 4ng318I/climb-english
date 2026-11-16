// ESCRIBIR: dictados cortísimos de palabras que la alumna ya domina, con teclado grande.
import { $, esc, shuffle, sleep } from '../core/util.js';
import { state, save } from '../core/store.js';
import { T } from '../core/i18n.js';
import { speak } from '../core/speech.js';
import { record } from '../core/session.js';
import { learnedWords, checkMedals } from '../core/path.js';
import { header, listenBtn, slowBtn, pic, howto, empty } from '../ui/layout.js';
import { keyboard } from '../ui/keyboard.js';
import { blip, cheer, gentle, bubble, confetti, chime } from '../ui/feedback.js';

const ROUNDS = 4;

function choose() {
  const ok = learnedWords().filter(w => /^[a-z]+$/i.test(w.en) && w.en.length > 1);
  const strong = ok.filter(w => state.words[w.id].box >= 2);
  const pool = strong.length >= 3 ? strong : ok;
  const never = shuffle(pool.filter(w => !state.words[w.id].written));
  return [...never, ...shuffle(pool.filter(w => state.words[w.id].written))].slice(0, ROUNDS);
}

export default async function writing(el) {
  const top = header(T('write_title'), '✍️');
  const items = choose();
  if (!items.length) { el.innerHTML = top + empty('✍️', 'empty_first'); return; }
  const results = [];

  for (let i = 0; i < items.length; i++) {
    if (!el.isConnected) return;
    const w = items[i];
    const goal = w.en.toLowerCase();
    let typed = '', attempt = 1, okLetters = null;

    el.innerHTML = `${top}
      <section class="stage writing">
        <div class="steps">${items.map((_, k) => `<span class="step${k < i ? ' done' : k === i ? ' now' : ''}">●</span>`).join('')}</div>
        ${howto('write_how')}
        <div class="listen-row">${listenBtn(w.en, true)}${slowBtn(w.en)}<div class="prompt small">${pic(w, true)}</div></div>
        <div class="model" id="model"></div>
        <div class="slots" id="slots"></div>
        ${keyboard()}
      </section>`;
    const slots = $('#slots', el);
    const draw = () => {
      slots.innerHTML = [...goal].map((_, k) =>
        `<span class="slot-letter${okLetters?.[k] ? ' ok' : ''}">${esc(typed[k] || '')}</span>`).join('');
    };
    draw();
    speak(w.en);

    await new Promise(next => {
      const onKey = async e => {
        const key = e.target.closest('.key')?.dataset.key;
        if (!key) return;
        okLetters = null;
        if (key === 'back') typed = typed.slice(0, -1);
        else if (typed.length < goal.length) typed += key;
        blip(520, 0.05);
        draw();
        if (typed.length < goal.length) return;

        el.onclick = null;
        if (typed === goal) {
          okLetters = [...goal].map(() => true);
          draw();
          const rec = state.words[w.id];
          rec.written = (rec.written || 0) + 1;
          state.stats.written++;
          results.push({ id: w.id, ok: attempt === 1 });
          cheer();
          await speak(w.en);
          return setTimeout(next, 600);
        }
        // Primero lo que ha salido bien; luego el modelo para copiarlo tranquilamente.
        okLetters = [...goal].map((c, k) => typed[k] === c);
        const good = okLetters.filter(Boolean).length;
        draw();
        if (attempt === 1) {
          attempt = 2;
          gentle(good ? T('write_good', { n: good }) : T('good_try'), T('write_better'));
          $('#model', el).innerHTML = `<span>${T('write_model')}</span> <b>${esc(w.en)}</b>`;
          await sleep(1800);
          typed = '';
          okLetters = null;
          draw();
          el.onclick = onKey;
        } else {
          results.push({ id: w.id, ok: false });
          typed = goal;
          okLetters = [...goal].map(() => true);
          draw();
          bubble(`<b>${T('write_seen')}</b>`);
          await speak(w.en);
          setTimeout(next, 900);
        }
      };
      el.onclick = onKey;
    });
  }

  if (!el.isConnected) return;
  record(results);
  checkMedals();
  save();
  el.innerHTML = `${top}
    <section class="stage"><div class="finish">
      <div class="big-emoji">✏️</div>
      <h2>${T('write_done')}</h2>
      <div class="chips">${items.map(w => `<button class="chip-word" data-say="${esc(w.en)}">${esc(w.emoji)} ${esc(w.en)}</button>`).join('')}</div>
      <div class="row">
        <button class="btn ghost" data-go="home">🏠 ${T('home')}</button>
        <button class="btn" data-go="write">✍️ ${T('more')}</button>
      </div>
    </div></section>`;
  chime();
  confetti(24);
}
