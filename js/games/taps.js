// ¿Cuántos golpecitos? Sílabas y dónde suena más fuerte la palabra.
import { $, esc, sample, sleep } from '../core/util.js';
import { T } from '../core/i18n.js';
import { speak } from '../core/speech.js';
import { howto, listenBtn, slowBtn } from '../ui/layout.js';
import { blip, bubble, cheer, chime, gentle, pop } from '../ui/feedback.js';

const dots = (n, strong = 0) => Array.from({ length: n }, (_, i) =>
  `<button class="dot${i + 1 === strong ? ' strong' : ''}" data-beat="${i + 1}">${i + 1}</button>`).join('');

export default {
  id: 'taps',
  icon: '🥁',
  can: c => c.words.length >= 2,

  async play(el, c) {
    // Que haya al menos una palabra de varios golpecitos, si se puede.
    const long = sample(c.words.filter(w => w.syllables > 1), 2);
    const items = [...long, ...sample(c.words.filter(w => !long.includes(w)), 3 - long.length)];
    const miss = new Set();

    for (const w of items) {
      if (!el.isConnected) return [];
      let n = 0;
      el.innerHTML = `${howto('taps_how')}
        <div class="taps">
          <div class="listen-row">${listenBtn(w.en, true)}${slowBtn(w.en)}</div>
          <div class="en">${esc(w.emoji)} ${esc(w.en)}</div>
          <div class="dots" id="dots"></div>
          <button class="drum" id="drum" aria-label="Tambor">🥁</button>
          <div class="row">
            <button class="btn ghost" id="clear" aria-label="Borrar">↺</button>
            <button class="btn" id="ok">${T('ready')}</button>
          </div>
        </div>`;
      speak(w.en, { slow: true });

      await new Promise(next => {
        el.onclick = e => {
          if (e.target.closest('#drum')) {
            if (n >= 6) return;
            n++;
            blip(200, 0.12);
            pop($('#drum', el));
            $('#dots', el).innerHTML = '<span class="dot">●</span>'.repeat(n);
          } else if (e.target.closest('#clear')) {
            n = 0;
            $('#dots', el).innerHTML = '';
          } else if (e.target.closest('#ok')) {
            if (!n) { bubble(T('taps_first')); return; }
            el.onclick = null;
            if (n === w.syllables) { chime(); bubble(`<b>${T('taps_yes', { n })}</b>`); }
            else { miss.add(w.id); gentle(T('good_rhythm'), T('taps_has', { n: w.syllables })); }
            next();
          }
        };
      });

      // Enseñar los golpecitos de verdad mientras suena despacio.
      $('#dots', el).innerHTML = dots(w.syllables);
      $('#drum', el).hidden = true;
      $('.row', el).hidden = true;
      await speak(w.en, { slow: true });
      await sleep(600);

      if (w.syllables > 1 && el.isConnected) {
        $('.howto', el).innerHTML = T('taps_strong');
        await new Promise(next => {
          el.onclick = e => {
            const b = e.target.closest('.dot');
            if (!b) return;
            el.onclick = null;
            if (+b.dataset.beat === w.stress) chime();
            else { miss.add(w.id); gentle(T('good_ear'), T('taps_strong_is', { n: w.stress })); }
            $('#dots', el).innerHTML = dots(w.syllables, w.stress);
            speak(w.en, { slow: true }).then(() => setTimeout(next, 700));
          };
        });
      }
    }
    cheer();
    await sleep(1000);
    return items.map(w => ({ id: w.id, ok: !miss.has(w.id) }));
  },
};
