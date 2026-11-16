// Puzzle de palabras revueltas: ordenar las piezas para formar la frase.
import { esc, shuffle, sample } from '../core/util.js';
import { T } from '../core/i18n.js';
import { speak } from '../core/speech.js';
import { howto, listenBtn } from '../ui/layout.js';
import { blip, cheer, chime, gentle } from '../ui/feedback.js';

const pieces = s => s.en.split(' ');
const usable = c => c.sentences.filter(s => pieces(s).length >= 3);

export default {
  id: 'scramble',
  icon: '🧱',
  can: c => usable(c).length > 0,

  async play(el, c) {
    const all = usable(c);
    const first = all.find(s => s === c.newSentence);
    const rounds = first ? [first, ...sample(all.filter(s => s !== first), 1)] : sample(all, 2);
    const miss = new Set();

    for (const s of rounds) {
      if (!el.isConnected) return [];
      const toks = pieces(s);
      let bank = shuffle(toks.map((_, i) => i));
      if (bank.every((v, i) => v === i)) bank.reverse();
      let tray = [], locked = 0;

      await new Promise(next => {
        const draw = () => {
          el.innerHTML = `${howto('scr_how')}
            <div class="prompt"><span class="pic-emoji">${esc(s.emoji)}</span><span class="pic-es">${esc(s.es)}</span>${listenBtn(s.en)}</div>
            <div class="tray">${tray.map((i, k) =>
              `<button class="tile piece${k < locked ? ' done' : ''}" data-tray="${k}">${esc(toks[i])}</button>`).join('') || '<span class="tray-hint">👇</span>'}</div>
            <div class="bank">${bank.map((i, k) =>
              `<button class="tile piece" data-bank="${k}">${esc(toks[i])}</button>`).join('')}</div>`;
        };
        draw();

        el.onclick = e => {
          const b = e.target.closest('.piece');
          if (!b) return;
          if (b.dataset.bank !== undefined) {
            tray.push(bank.splice(+b.dataset.bank, 1)[0]);
            blip(440 + tray.length * 40, 0.07);
          } else if (+b.dataset.tray >= locked) {
            bank.push(tray.splice(+b.dataset.tray, 1)[0]);
          } else return;

          if (bank.length) return draw();

          // Todas colocadas: ¿cuántas del principio están en su sitio?
          let good = 0;
          while (good < toks.length && toks[tray[good]] === toks[good]) good++;
          if (good === toks.length) {
            locked = good;
            draw();
            el.onclick = null;
            chime();
            speak(s.en).then(() => setTimeout(next, 500));
            return;
          }
          miss.add(s.id);
          locked = good;
          bank = shuffle(tray.splice(good));
          draw();
          if (good > 0) gentle(T('scr_good', { n: good }), T('scr_rest'));
          else { gentle(T('good_try'), T('scr_listen')); speak(s.en); }
        };
      });
    }
    cheer();
    await new Promise(r => setTimeout(r, 1000));
    return rounds.map(s => ({ id: s.id, ok: !miss.has(s.id) }));
  },
};
