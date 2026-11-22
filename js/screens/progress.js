// MI PROGRESO: qué falta para subir, mapa del camino, diario, barras de la etapa y medallas.
// Regla de esta pantalla: todo número dice de dónde sale ("3 de 64"), nada de porcentajes sueltos.
import { $, esc, niceDate } from '../core/util.js';
import { content } from '../core/content.js';
import { state, saveSoon } from '../core/store.js';
import { T, t, tt } from '../core/i18n.js';
import {
  learnedWords, learnedSentences, blockDone, blockProgress, currentBlock, currentStage,
  stageProgress, stagesDone, songWordCount,
} from '../core/path.js';
import { header } from '../ui/layout.js';
import { areaChart, wireChart, domainBars, routeMap, wireGecko } from '../ui/charts.js';
import { nextStep, howMany } from '../ui/nextstep.js';
import { GAMES } from '../core/session.js';

const DIARY_DAYS = 7;   // días de juego que enseña el diario
const CHART_FROM = 4;   // a partir de cuántos días de juego aparece la gráfica

// Diario: una tarjeta por cada día en que se ha jugado. Los días sin entrar no aparecen.
function diary(played) {
  if (!played.length) return `<p class="soon">${T('chart_empty')}</p>`;
  const cards = played.slice(-DIARY_DAYS).map(d => {
    const w = d.newWords || 0, s = d.newSentences || 0;
    return `
      <div class="day-card">
        <b>${niceDate(d.date)}</b>
        <div class="day-dots">${'<i class="dw"></i>'.repeat(w)}${'<i class="ds"></i>'.repeat(s)}</div>
        <span>+${esc(howMany(w, s) || t('just_played'))}</span>
      </div>`;
  }).join('');
  return `<div class="diary">${cards}</div>
    <p class="note"><i class="dw"></i> ${T('diary_word')} &nbsp; <i class="ds"></i> ${T('diary_sentence')}</p>`;
}

export default function progress(el) {
  const words = learnedWords().length;
  const sentences = learnedSentences().length;
  const medals = Object.keys(state.medals).length;
  const songWords = songWordCount();
  const cur = currentBlock();
  // Donde esta la lagartija, en "agarres": el agarre actual mas la parte del bloque que
  // lleva hecha. Avanza con cada palabra nueva, no de golpe al cerrar el bloque, que es
  // lo que hacia que pareciera quieta. Y llega justo al agarre siguiente cuando se cierra.
  const geckoTo = (() => {
    const i = content.blocks.findIndex(b => b.n === cur.n);
    const pr = blockProgress(cur);
    const f = pr.wordsTotal ? pr.words / pr.wordsTotal : 0;
    return Math.min(content.blocks.length - 1, Math.max(0, i) + f);
  })();
  // De donde viene: lo ultimo que vio la alumna. Asi el avance del dia se ve MOVERSE.
  const geckoFrom = Number.isFinite(state.stats.geckoAt) ? state.stats.geckoAt : geckoTo;
  const crowned = stagesDone();
  const stage = currentStage();
  const sp = stageProgress(stage);

  const holds = content.blocks.map(b => {
    const p = blockProgress(b);
    const status = blockDone(b) ? 'done' : b.n === cur.n ? 'current' : 'locked';
    const tip = `${b.emoji} ${tt(b.title)} · ${p.words} ${t('of')} ${p.wordsTotal} ${t('words')} · ${p.sentences} ${t('of')} ${p.sentencesTotal} ${t('sentences')}`;
    return { emoji: b.emoji, stage: b.stage, status, tip };
  });

  const played = state.days.filter(d => (d.newWords || 0) + (d.newSentences || 0) > 0 || d.minutes > 0);
  let sum = 0;
  const points = state.days.filter(d => d.newWords > 0).map(d => ({ label: niceDate(d.date), value: (sum += d.newWords) }));

  // Barras de la etapa actual: cada una contra el total de la etapa, con su cuenta al lado.
  const rows = [
    { emoji: '🧠', label: T('bar_words'), value: sp.words, total: sp.wordsTotal },
    { emoji: '💬', label: T('bar_sentences'), value: sp.sentences, total: sp.sentencesTotal },
    { emoji: '📚', label: T('bar_tricks'), value: sp.tricks, total: sp.tricksTotal },
    { emoji: '🗣️', label: T('bar_said'), value: sp.said, total: sp.saidTotal },
    { emoji: '✍️', label: T('bar_written'), value: sp.written, total: sp.writtenTotal },
  ];

  el.innerHTML = `${header(T('progress_title'), '📊')}
    <section class="stage progress">
      <div class="stats">
        <div class="stat s1"><b>${words}</b><span>${T('words')}</span></div>
        <div class="stat s2"><b>${sentences}</b><span>${T('sentences')}</span></div>
        <div class="stat s3"><b>${medals}</b><span>${T('medals')}</span></div>
        <div class="stat s4"><b>${songWords}</b><span>${T('stat_songs')}</span></div>
        <div class="stat s5"><b>${state.stats.freeGames}</b><span>${T('stat_free')}</span></div>
      </div>
      <button class="btn ghost" data-go="words">📒 ${T('see_words')}</button>

      <div class="panel next">
        <h2>🎯 ${T('next_title')}</h2>
        ${nextStep()}
      </div>

      <div class="panel gym-panel">
        <h2>🧗 ${T('gym_title')}</h2>
        <div class="bars">
          ${domainBars([
            { emoji: '🧗', label: T('gym_rounds'), value: state.stats.freeGames, total: Math.max(10, Math.ceil((state.stats.freeGames + 1) / 10) * 10) },
            { emoji: '🔁', label: T('gym_reviews'), value: state.stats.reviews, total: Math.max(50, Math.ceil((state.stats.reviews + 1) / 50) * 50) },
            { emoji: '🔥', label: T('gym_streak'), value: state.stats.bestStreak, total: Math.max(10, Math.ceil((state.stats.bestStreak + 1) / 10) * 10) },
            { emoji: '🎲', label: T('gym_games'), value: Object.keys(state.stats.games).length, total: GAMES.length },
          ], t('of'))}
        </div>
        <p class="note">${T('gym_note')}</p>
        <button class="btn" data-go="gym">🧗 ${T('gym_go')}</button>
      </div>

      <div class="panel">
        <h2>🗺️ ${T('map_title')}</h2>
        ${routeMap(holds, { from: geckoFrom, to: geckoTo })}
        <p class="caption" id="caption">${esc(holds.find(h => h.status === 'current')?.tip || '')}</p>
        <p class="note center">${T('map_hint')}</p>
        <div class="legend">${content.stages.map(s => `
          <span class="stage-chip st${s.n}${s.n <= crowned ? ' crowned' : ''}">${s.n <= crowned ? '👑' : esc(s.emoji)} ${esc(tt(s.name))}</span>`).join('')}</div>
      </div>

      <div class="panel">
        <h2>💪 ${T('stage_bars_title', { stage: tt(stage.name) })}</h2>
        ${domainBars(rows, t('of'))}
        <p class="note">${T('stage_bars_note')}</p>
      </div>

      <div class="panel">
        <h2>📅 ${T('diary_title')}</h2>
        ${diary(played)}
        ${points.length >= CHART_FROM ? `<h3>📈 ${T('chart_title')}</h3>${areaChart(points, t('words'))}` : ''}
      </div>

      <div class="panel">
        <h2>🏅 ${T('medals_title')}</h2>
        <div class="medals">${content.medals.map(m => state.medals[m.id]
          ? `<div class="medal got"><span class="m-emoji">${esc(m.emoji)}</span><b>${esc(tt(m.title))}</b><small>${niceDate(state.medals[m.id])}</small></div>`
          : `<div class="medal"><span class="m-emoji">❔</span><small>${esc(tt(m.desc))}</small></div>`).join('')}
          ${/* Medallas ganadas que ya no están en el catálogo: se siguen viendo, no se pierden. */ ''}
          ${Object.keys(state.medals).filter(id => !content.medals.some(m => m.id === id)).map(id =>
            `<div class="medal got"><span class="m-emoji">🏅</span><b>${T('old_medal')}</b><small>${niceDate(state.medals[id])}</small></div>`).join('')}</div>
      </div>
    </section>`;

  wireChart(el);
  wireGecko(el);
  if (state.stats.geckoAt !== geckoTo) {
    state.stats.geckoAt = geckoTo;
    saveSoon();
  }
  const caption = $('#caption', el);
  const tip = e => {
    const h = e.target.closest('.hold');
    if (h) caption.textContent = h.dataset.tip;
  };
  $('.route', el).addEventListener('pointerdown', tip);
  $('.route', el).addEventListener('focusin', tip);
}
