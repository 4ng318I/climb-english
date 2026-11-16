// Inventar una frase tonta con las palabras que la alumna ya sabe. Aquí todo vale.
import { esc, pick, sample } from '../core/util.js';
import { content } from '../core/content.js';
import { state, save } from '../core/store.js';
import { currentBlock } from '../core/path.js';
import { T } from '../core/i18n.js';
import { speak } from '../core/speech.js';
import { howto, listenBtn, slowBtn } from '../ui/layout.js';
import { bubble, chime, confetti } from '../ui/feedback.js';

const ofKind = (c, pos) => c.learned.filter(w => w.pos === pos);
const fillable = (m, c) => m.parts.every(p => typeof p === 'string' || ofKind(c, p.pos).length >= 2);
const moulds = c => content.silly.filter(m => m.block <= currentBlock().n && fillable(m, c));
const gloss = es => String(es || '').split('/')[0].replace(/\(.*?\)/g, '').trim();

export default {
  id: 'silly',
  icon: '🤪',
  can: c => moulds(c).length > 0,

  async play(el, c) {
    const used = new Set();
    for (let made = 0; made < 3; made++) {
      if (!el.isConnected) return [];
      const m = pick(moulds(c));
      const slots = m.parts.map(p => (typeof p === 'string' ? { fixed: p } : { pos: p.pos, word: null }));

      // Elegir palabra hueco a hueco.
      for (const slot of slots.filter(s => !s.fixed)) {
        const taken = slots.filter(s => s.word).map(s => s.word);
        const options = sample(ofKind(c, slot.pos).filter(w => !taken.includes(w)), 4);
        slot.active = true;
        el.innerHTML = `${howto('silly_how')}
          <div class="silly-line">${slots.map(s => s.fixed
            ? `<span class="fixed">${esc(s.fixed)}</span>`
            : `<span class="slot${s.active ? ' active' : ''}${s.word ? ' filled' : ''}">${s.word ? esc(s.word.en) : '❓'}</span>`).join(' ')}</div>
          <div class="options">${options.map(w =>
            `<button class="tile chip" data-id="${esc(w.id)}"><span class="pic-emoji">${esc(w.emoji)}</span><b>${esc(w.en)}</b><span class="pic-es">${esc(gloss(w.es))}</span></button>`).join('')}</div>`;
        await new Promise(next => {
          el.onclick = e => {
            const b = e.target.closest('.chip');
            if (!b) return;
            el.onclick = null;
            slot.word = content.wordById.get(b.dataset.id);
            slot.active = false;
            used.add(slot.word.id);
            speak(slot.word.en);
            setTimeout(next, 350);
          };
        });
      }

      // Montar la frase (y arreglar a/an para que suene bien).
      const toks = slots.map(s => (s.fixed ? { en: s.fixed, es: gloss(content.wordByEn.get(s.fixed.toLowerCase())?.es) }
        : { en: s.word.en, es: gloss(s.word.es), emoji: s.word.emoji }));
      toks.forEach((t, i) => {
        if (t.en.toLowerCase() === 'a' && toks[i + 1] && /^[aeiou]/i.test(toks[i + 1].en)) t.en = t.en === 'A' ? 'An' : 'an';
      });
      const text = toks.map(t => t.en).join(' ').replace(/ \?/g, '?') + (toks.at(-1).en === '?' ? '' : '.');

      state.stats.silly++;
      save();
      el.innerHTML = `${howto('silly_wow')}
        <div class="silly-result">
          <div class="silly-emojis">${toks.map(t => esc(t.emoji || '')).join(' ')} ${esc(m.emoji)}</div>
          <div class="listen-row">${listenBtn(text, true)}${slowBtn(text)}</div>
          <div class="silly-words">${toks.filter(t => t.en !== '?').map(t =>
            `<span class="sw"><b>${esc(t.en)}</b><small>${esc(t.es || '·')}</small></span>`).join('')}</div>
          <div class="row">
            ${made < 2 ? `<button class="btn ghost" id="more">🎲 ${T('another')}</button>` : ''}
            <button class="btn" id="go">${T('continue')} ➜</button>
          </div>
        </div>`;
      chime();
      confetti(12);
      bubble(`<b>${T('silly_cheer')}</b>`, 2200);
      speak(text);

      const more = await new Promise(next => {
        el.onclick = e => {
          if (e.target.closest('#more')) { el.onclick = null; next(true); }
          else if (e.target.closest('#go')) { el.onclick = null; next(false); }
        };
      });
      if (!more) break;
    }
    return [...used].map(id => ({ id, ok: true }));
  },
};
