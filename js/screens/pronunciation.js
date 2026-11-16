// PRONUNCIACIÓN: la voz manda. Primero escuchar (botón enorme), luego repetir.
// Con micro se compara con cariño; sin micro o sin internet, "escucha y repite".
import { $, shuffle, pick } from '../core/util.js';
import { state, save } from '../core/store.js';
import { T } from '../core/i18n.js';
import { speak, listen, micReady, soundsLike } from '../core/speech.js';
import { learnedWords, learnedSentences, checkMedals } from '../core/path.js';
import { header, wordCard, empty } from '../ui/layout.js';
import { bubble, cheer, gentle, confetti, chime } from '../ui/feedback.js';

const zone = mic => mic
  ? `<button class="mic" id="mic" aria-label="Micrófono">🎤<span>${T('your_turn')}</span></button>`
  : `<p class="howto">${T('listen_repeat')}</p><button class="btn" id="said">🙋 ${T('i_said_it')}</button>`;

export default async function pronunciation(el) {
  const top = header(T('pron_title'), '🗣️');
  const learned = learnedWords();
  if (!learned.length) { el.innerHTML = top + empty('🗣️', 'empty_first'); return; }

  // Primero las que todavía no ha dicho nunca en voz alta.
  const never = shuffle(learned.filter(w => !state.words[w.id].said));
  const items = [...never, ...shuffle(learned.filter(w => state.words[w.id].said))].slice(0, 5);
  const sentences = learnedSentences();
  if (sentences.length) items.push(pick(sentences));
  let useMic = micReady();

  for (let i = 0; i < items.length; i++) {
    if (!el.isConnected) return;
    const item = items[i];
    let counted = false, tries = 0, busy = false;
    const mark = () => {
      if (counted) return;
      counted = true;
      const rec = state.words[item.id];
      if (rec) rec.said = (rec.said || 0) + 1;
      state.stats.said++;
      save();
    };

    el.innerHTML = `${top}
      <section class="stage">
        <div class="steps">${items.map((_, k) => `<span class="step${k < i ? ' done' : k === i ? ' now' : ''}">●</span>`).join('')}</div>
        ${wordCard(item)}
        <div class="say-zone" id="zone">${zone(useMic)}</div>
        <button class="btn ghost" id="skip">${T('next')} ➜</button>
      </section>`;
    speak(item.en);

    await new Promise(next => {
      const finish = ms => { el.onclick = null; setTimeout(next, ms); };
      el.onclick = async e => {
        if (e.target.closest('#skip')) return finish(0);
        if (e.target.closest('#said')) { mark(); cheer(); return finish(1300); }
        const mic = e.target.closest('#mic');
        if (!mic || busy) return;
        busy = true;
        mic.classList.add('on');
        const heard = await listen();
        mic.classList.remove('on');
        busy = false;
        if (!el.isConnected) return;
        if (heard === null) {
          // El micro no ha funcionado: seguimos sin puntuar, sin drama.
          useMic = false;
          $('#zone', el).innerHTML = zone(false);
          bubble(T('mic_rest'));
          return;
        }
        mark();
        tries++;
        if (soundsLike(item.en, heard)) { cheer(); return finish(1300); }
        gentle(T('heard_you'), T('even_better'));
        await speak(item.en, { slow: true });
        if (tries >= 2) { bubble(`<b>${T('brave_voice')}</b>`); finish(1600); }
      };
    });
  }

  if (!el.isConnected) return;
  checkMedals();
  save();
  el.innerHTML = `${top}
    <section class="stage"><div class="finish">
      <div class="big-emoji">🎤</div>
      <h2>${T('pron_done')}</h2>
      <div class="row">
        <button class="btn ghost" data-go="home">🏠 ${T('home')}</button>
        <button class="btn" data-go="pron">🗣️ ${T('more')}</button>
      </div>
    </div></section>`;
  chime();
  confetti(24);
}
