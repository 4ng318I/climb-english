// Memory de parejas: una carta en inglés y su pareja en español.
import { $$, esc, shuffle, distinct, sleep } from '../core/util.js';
import { speak } from '../core/speech.js';
import { englishLevel } from '../core/path.js';
import { howto, pic } from '../ui/layout.js';
import { cheer, chime, pop } from '../ui/feedback.js';

export default {
  id: 'memory',
  icon: '🃏',
  can: c => distinct(c.words, 3).length >= 3,

  play(el, c) {
    return new Promise(resolve => {
      const items = distinct(c.words, englishLevel() >= 30 ? 6 : 4);
      const byId = Object.fromEntries(items.map(w => [w.id, w]));
      const cards = shuffle(items.flatMap(w => [{ id: w.id, side: 'en' }, { id: w.id, side: 'es' }]));
      let open = [], busy = false, left = items.length;

      el.innerHTML = `${howto('memory_how')}
        <div class="memory n${cards.length}">${cards.map((k, i) => `
          <button class="mcard" data-i="${i}">
            <span class="back">🧗</span>
            <span class="face">${k.side === 'en' ? `<b>${esc(byId[k.id].en)}</b>` : pic(byId[k.id], true)}</span>
          </button>`).join('')}</div>`;
      const btns = $$('.mcard', el);

      el.onclick = async e => {
        const b = e.target.closest('.mcard');
        if (!b || busy || b.classList.contains('up')) return;
        const card = cards[+b.dataset.i];
        b.classList.add('up');
        if (card.side === 'en') speak(byId[card.id].en);
        open.push(b);
        if (open.length < 2) return;

        const [a, z] = open.map(x => cards[+x.dataset.i]);
        if (a.id === z.id && a.side !== z.side) {
          open.forEach(x => { x.classList.add('done'); pop(x); });
          open = [];
          chime();
          if (--left === 0) {
            el.onclick = null;
            cheer();
            setTimeout(() => resolve(items.map(w => ({ id: w.id, ok: true }))), 1300);
          }
        } else {
          busy = true;
          await sleep(1200);
          open.forEach(x => x.classList.remove('up'));
          open = [];
          busy = false;
        }
      };
      void btns;
    });
  },
};
