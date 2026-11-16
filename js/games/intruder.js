// Cazar al intruso: tres opciones, dos son intrusas disfrazadas y una es la de verdad.
import { esc, shuffle, distinct } from '../core/util.js';
import { T } from '../core/i18n.js';
import { speak } from '../core/speech.js';
import { howto, pic, listenBtn } from '../ui/layout.js';
import { cheer, chime, gentle, pop } from '../ui/feedback.js';

const pool = c => {
  const seen = new Set();
  return [...c.words, ...c.learned].filter(w => !seen.has(w.id) && seen.add(w.id));
};

export default {
  id: 'intruder',
  icon: '🕵️',
  can: c => distinct(pool(c), 3).length >= 3,

  async play(el, c) {
    const all = pool(c);
    const targets = distinct(c.words, 4);
    const miss = new Set();

    for (let i = 0; i < targets.length; i++) {
      if (!el.isConnected) return [];
      const w = targets[i];
      const others = distinct(all.filter(x =>
        x.id !== w.id && x.emoji !== w.emoji && x.es !== w.es && x.en.toLowerCase() !== w.en.toLowerCase()), 2);
      if (others.length < 2) continue;
      const opts = shuffle([w, ...others]);
      const byId = Object.fromEntries(opts.map(o => [o.id, o]));
      const hear = i % 2 === 1; // rondas impares: escuchar y elegir el dibujo

      el.innerHTML = `${howto(hear ? 'intruder_how_listen' : 'intruder_how')}
        <div class="prompt">${hear ? listenBtn(w.en, true) : pic(w, true)}</div>
        <div class="options">${opts.map(o =>
          `<button class="tile opt${hear ? ' picture' : ' word'}" data-id="${esc(o.id)}">${hear ? pic(o, true) : esc(o.en)}</button>`).join('')}</div>`;
      if (hear) speak(w.en);

      await new Promise(next => {
        el.onclick = e => {
          const b = e.target.closest('.opt');
          if (!b || b.disabled) return;
          if (b.dataset.id === w.id) {
            el.onclick = null;
            b.classList.add('done');
            pop(b);
            chime();
            speak(w.en);
            setTimeout(next, 1200);
          } else {
            miss.add(w.id);
            b.disabled = true;
            b.classList.add('faded');
            const o = byId[b.dataset.id];
            gentle(T('good_try'), T('that_is', { en: o.en, es: o.es }));
          }
        };
      });
    }
    cheer();
    await new Promise(r => setTimeout(r, 1000));
    return targets.map(w => ({ id: w.id, ok: !miss.has(w.id) }));
  },
};
