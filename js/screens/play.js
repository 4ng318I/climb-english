// APRENDER LO NUEVO: presenta lo nuevo (3 palabras o 1 frase), lo trabaja con minijuegos
// y, si todavía queda algo nuevo hoy, ENCADENA la tanda siguiente sin salir de aquí.
//
// Lo nuevo nunca está escondido: va al principio de cada tanda, y entre tandas hay un
// puente que dice cuánto queda y deja seguir con un toque. Parar es igual de fácil y no
// se presenta como abandonar.
import { $, esc } from '../core/util.js';
import { content } from '../core/content.js';
import { state, save, today } from '../core/store.js';
import { T, tt, newlyEnglish } from '../core/i18n.js';
import { speak } from '../core/speech.js';
import { makePlan, pickGames, learnWords, learnSentence, record, playedGame, sinFallos } from '../core/session.js';
import { learnedWords, stagesDone, englishLevel, checkMedals, blockDone, currentBlock } from '../core/path.js';
import { wordCard } from '../ui/layout.js';
import { chime, confetti, bubble } from '../ui/feedback.js';
import { nextStep, nothingNewToday, howMany } from '../ui/nextstep.js';

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

// Celebración al completar un bloque del mapa.
async function holds(stage) {
  const seen = state.ui.blocksSeen || (state.ui.blocksSeen = []);
  const conquered = content.blocks.filter(b => blockDone(b) && !seen.includes(b.n));
  if (!conquered.length) return true;
  seen.push(...conquered.map(b => b.n));
  save();
  const b = conquered[conquered.length - 1], next = currentBlock();
  stage.className = 'stage';
  stage.innerHTML = `
    <div class="finish crown">
      <div class="big-emoji">${esc(b.emoji)}</div>
      <h2>${T('hold_done', { block: tt(b.title) })}</h2>
      <p>${T('hold_done_text', { n: content.words.filter(w => w.block === b.n).length })}</p>
      ${next.n !== b.n ? `<p class="next-line">🪨 ${T('hold_next', { block: tt(next.title) })} ${esc(next.emoji)}</p>` : ''}
      <button class="btn next">${T('continue')} ➜</button>
    </div>`;
  chime();
  confetti(36);
  await tap(stage, '.next');
  return stage.isConnected;
}

// ¿La tanda siguiente trae algo nuevo de verdad? (makePlan no cambia nada al mirarlo)
function queda() {
  const p = makePlan();
  return { words: p.newWords.length, sentence: p.newSentence ? 1 : 0 };
}

// El puente entre tandas. Seguir es el botón principal; parar es igual de fácil y se
// presenta como "lo dejo para luego", nunca como rendirse.
async function bridge(stage, pendiente) {
  stage.className = 'stage';
  stage.innerHTML = `
    <div class="finish bridge">
      <div class="big-emoji">✨</div>
      <h2>${T('bridge_title')}</h2>
      <p class="bridge-what">${T('bridge_what', { what: howMany(pendiente.words, pendiente.sentence) })}</p>
      <button class="btn bridge-go" id="seguir">✨ ${T('bridge_go')}</button>
      <button class="btn ghost" id="parar">${T('bridge_stop')}</button>
      <p class="note">${T('bridge_stop_note')}</p>
    </div>`;
  chime();
  confetti(14);
  return new Promise(resolve => {
    stage.onclick = e => {
      if (e.target.closest('#seguir')) { stage.onclick = null; resolve(true); }
      else if (e.target.closest('#parar')) { stage.onclick = null; resolve(false); }
    };
  });
}

export default async function play(el) {
  const started = Date.now();
  el.innerHTML = `
    <header class="bar">
      <button class="round" data-go="home" aria-label="Inicio">🏠</button>
      <div class="steps" id="steps"></div>
    </header>
    <section class="stage" id="stage"></section>`;
  const stage = $('#stage', el);
  const steps = $('#steps', el);
  const descubierto = [];   // todo lo nuevo de esta visita, para la pantalla final
  let medals = [];

  // Una vuelta por tanda: lo nuevo, los juegos, y el puente si queda más.
  for (;;) {
    const plan = makePlan();

    if (plan.newWords.length) {
      if (!await introduce(stage, plan.newWords, 'new_word')) return;
      learnWords(plan.newWords);
      descubierto.push(...plan.newWords);
    } else if (plan.newSentence) {
      if (!await introduce(stage, [plan.newSentence], 'new_sentence')) return;
      learnSentence(plan.newSentence);
      descubierto.push(plan.newSentence);
    } else if (!descubierto.length && nothingNewToday()) {
      // Partida sin novedades: se dice al empezar, en positivo.
      bubble(T('review_only'), 4200);
    }

    const ctx = { ...plan, learned: learnedWords() };
    const games = pickGames(ctx);
    let perfectas = 0;
    for (let i = 0; i < games.length; i++) {
      steps.innerHTML = games.map((g, k) =>
        `<span class="step${k < i ? ' done' : k === i ? ' now' : ''}">${g.icon}</span>`).join('');
      stage.className = 'stage game-' + games[i].id;
      stage.innerHTML = '';
      playedGame(games[i].id);
      const results = await games[i].play(stage, ctx);
      if (!stage.isConnected) return;
      record(results);
      if (sinFallos(results)) perfectas++;
    }
    steps.innerHTML = '';

    state.stats.sessions++;
    if (games.length && perfectas === games.length) state.stats.perfect++;
    medals = medals.concat(checkMedals());
    save();

    if (!await holds(stage)) return;
    if (stagesDone() > state.ui.stageSeen) {
      await crown(stage);
      if (!stage.isConnected) return;
    }

    const pendiente = queda();
    if (!pendiente.words && !pendiente.sentence) break;
    if (!await bridge(stage, pendiente)) break;
    if (!stage.isConnected) return;
  }

  today().minutes += Math.min(30, Math.max(1, Math.round((Date.now() - started) / 60000)));
  save();

  stage.className = 'stage';
  stage.innerHTML = `
    <div class="finish">
      <div class="big-emoji">🏆</div>
      <h2>${T('finish_title')}</h2>
      ${descubierto.length ? `<p>${T('finish_new')}</p>
        <div class="chips">${descubierto.map(w =>
          `<button class="chip-word" data-say="${esc(w.en)}">${esc(w.emoji)} ${esc(w.en)}</button>`).join('')}</div>` : ''}
      ${medals.length ? `<p>${T('new_medal')}</p>
        <div class="chips">${medals.map(m =>
          `<span class="medal got"><span class="m-emoji">${esc(m.emoji)}</span>${esc(tt(m.title))}</span>`).join('')}</div>` : ''}
      <div class="next-box">${nextStep({ compact: true })}</div>
      <div class="row">
        <button class="btn ghost" data-go="progress">📊 ${T('see_progress')}</button>
        ${nothingNewToday()
          ? `<button class="btn ghost" data-go="song">🎵 ${T('song_title')}</button>`
          : `<button class="btn ghost" data-go="play">✨ ${T('learn_new')}</button>`}
        <button class="btn" data-go="gym">🧗 ${T('gym_title')}</button>
      </div>
    </div>`;
  chime();
  confetti(30);
}
