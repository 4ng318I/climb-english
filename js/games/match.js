// Emparejar palabra y dibujo.
import { $$, esc, shuffle, distinct } from '../core/util.js';
import { T } from '../core/i18n.js';
import { speak } from '../core/speech.js';
import { howto, pic } from '../ui/layout.js';
import { bubble, cheer, chime, gentle, pop, wobble } from '../ui/feedback.js';

export default {
  id: 'match',
  icon: '🧩',
  can: c => distinct(c.words, 3).length >= 3,

  play(el, c) {
    return new Promise(resolve => {
      const items = distinct(c.words, 4);
      const miss = new Set();
      let sel = null, left = items.length;

      el.innerHTML = `${howto('match_how')}
        <div class="match">
          <div class="col">${shuffle(items).map(w =>
            `<button class="tile word" data-id="${esc(w.id)}">${esc(w.en)}</button>`).join('')}</div>
          <div class="col">${shuffle(items).map(w =>
            `<button class="tile picture" data-id="${esc(w.id)}">${pic(w)}</button>`).join('')}</div>
        </div>`;

      el.onclick = e => {
        const b = e.target.closest('.tile');
        if (!b || b.disabled) return;
        if (b.classList.contains('word')) {
          $$('.word.sel', el).forEach(x => x.classList.remove('sel'));
          b.classList.add('sel');
          sel = b;
          speak(b.textContent);
          return;
        }
        if (!sel) { bubble(T('match_first')); return; }
        if (sel.dataset.id === b.dataset.id) {
          for (const x of [sel, b]) { x.classList.remove('sel'); x.classList.add('done'); x.disabled = true; }
          pop(b);
          chime();
          sel = null;
          if (--left === 0) {
            el.onclick = null;
            cheer();
            setTimeout(() => resolve(items.map(w => ({ id: w.id, ok: !miss.has(w.id) }))), 1300);
          }
        } else {
          miss.add(sel.dataset.id);
          wobble(b);
          gentle(T('near'), T('try_other'));
        }
      };
    });
  },
};
