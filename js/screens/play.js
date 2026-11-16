// APRENDER JUGANDO: presenta lo nuevo (3 palabras o 1 frase) y encadena minijuegos.
import { $, esc } from '../core/util.js';
import { content } from '../core/content.js';
import { state, save, today } from '../core/store.js';
import { T, tt, newlyEnglish } from '../core/i18n.js';
import { speak } from '../core/speech.js';
import { makePlan, pickGames, learnWords, learnSentence, record } from '../core/session.js';
import { learnedWords, stagesDone, englishLevel, checkMedals } from '../core/path.js';
import { wordCard } from '../ui/layout.js';
import { chime, confetti } from '../ui/feedback.js';

const tap = (root, sel) => new Promise(resolve => {
  root.onclick = e => { if (e.target.closest(sel)) { root.onclick = null; resolve(); } };
});

async function introduce(stage, items, tagKey) {
  for (let i = 0; i < items.length; i++) {
    if (!stage.isConnected) return false;
    const count = items.length > 1 ? ` ${i + 1}/${items.length}` : '';
    stage.innerHTML = `${wordCard(items[i], { tag: `✨ ${T(tagKey)}${count}` })}
      <button class="btn next">${T('got_it')} ➜</button>`;
    speak(items[i].en);
    await tap(stage, '.next');
  }
  return stage.isConnected;
}

// Celebración al coronar una etapa: aquí es donde la app pasa a hablar más inglés.
async function crown(stage) {
  const before = englishLevel();
  const done = content.stages[Math.min(state.ui.stageSeen, content.stages.length - 1)];
  state.ui.stageSeen = stagesDone();
  save();
  const after = englishLevel();
  const summit = state.ui.stageSeen >= content.stages.length;
  const flips = newlyEnglish(before, after);
  stage.className = 'stage';
  stage.innerHTML = `
    <div class="finish crown">
      <div class="big-emoji">${summit ? '🏔️' : '👑'}</div>
      <h2>${T('crown_title', { stage: tt(done.name) })}</h2>
      <p>${T(summit ? 'crown_summit' : 'crown_text')}</p>
      ${flips.length ? `<div class="flips">${flips.map(f =>
        `<div class="flip"><span>${esc(f.es)}</span> ➜ <b>${esc(f.en)}</b></div>`).join('')}</div>` : ''}
      <button class="btn next">${T('continue')} ➜</button>
    </div>`;
  chime();
  confetti(40);
  await tap(stage, '.next');
}

export default async function play(el) {
  const plan = makePlan();
  const started = Date.now();
  el.innerHTML = `
    <header class="bar">
      <button class="round" data-go="home" aria-label="Inicio">🏠</button>
      <div class="steps" id="steps"></div>
    </header>
    <section class="stage" id="stage"></section>`;
  const stage = $('#stage', el);

  if (plan.newWords.length) {
    if (!await introduce(stage, plan.newWords, 'new_word')) return;
    learnWords(plan.newWords);
  } else if (plan.newSentence) {
    if (!await introduce(stage, [plan.newSentence], 'new_sentence')) return;
    learnSentence(plan.newSentence);
  }

  const ctx = { ...plan, learned: learnedWords() };
  const games = pickGames(ctx);
  const steps = $('#steps', el);
  for (let i = 0; i < games.length; i++) {
    steps.innerHTML = games.map((g, k) =>
      `<span class="step${k < i ? ' done' : k === i ? ' now' : ''}">${g.icon}</span>`).join('');
    stage.className = 'stage game-' + games[i].id;
    stage.innerHTML = '';
    const results = await games[i].play(stage, ctx);
    if (!stage.isConnected) return;
    record(results);
  }
  steps.innerHTML = '';

  state.stats.sessions++;
  today().minutes += Math.min(15, Math.max(1, Math.round((Date.now() - started) / 60000)));
  const medals = checkMedals();
  save();
  if (stagesDone() > state.ui.stageSeen) {
    await crown(stage);
    if (!stage.isConnected) return;
  }

  const fresh = [...plan.newWords, ...(plan.newSentence ? [plan.newSentence] : [])];
  stage.className = 'stage';
  stage.innerHTML = `
    <div class="finish">
      <div class="big-emoji">🏆</div>
      <h2>${T('finish_title')}</h2>
      ${fresh.length ? `<p>${T('finish_new')}</p>
        <div class="chips">${fresh.map(w =>
          `<button class="chip-word" data-say="${esc(w.en)}">${esc(w.emoji)} ${esc(w.en)}</button>`).join('')}</div>` : ''}
      ${medals.length ? `<p>${T('new_medal')}</p>
        <div class="chips">${medals.map(m =>
          `<span class="medal got"><span class="m-emoji">${esc(m.emoji)}</span>${esc(tt(m.title))}</span>`).join('')}</div>` : ''}
      <div class="row">
        <button class="btn ghost" data-go="progress">📊 ${T('see_progress')}</button>
        <button class="btn" data-go="play">🎮 ${T('play_again')}</button>
      </div>
    </div>`;
  chime();
  confetti(30);
}
