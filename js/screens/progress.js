// MI PROGRESO: mapa del camino, palabras en el tiempo, dominio por área y medallas.
import { $, esc, niceDate } from '../core/util.js';
import { content, blockWords } from '../core/content.js';
import { state } from '../core/store.js';
import { T, t, tt } from '../core/i18n.js';
import { learnedWords, learnedSentences, blockDone, currentBlock, stagesDone, domains } from '../core/path.js';
import { header } from '../ui/layout.js';
import { areaChart, wireChart, domainBars, routeMap } from '../ui/charts.js';

export default function progress(el) {
  const words = learnedWords().length;
  const sentences = learnedSentences().length;
  const medals = Object.keys(state.medals).length;
  const cur = currentBlock();
  const crowned = stagesDone();

  const holds = content.blocks.map(b => {
    const all = blockWords(b.n);
    const got = all.filter(w => state.words[w.id]).length;
    const status = blockDone(b) ? 'done' : b.n === cur.n ? 'current' : 'locked';
    return { emoji: b.emoji, stage: b.stage, status, tip: `${b.emoji} ${tt(b.title)} · ${got}/${all.length} ${t('words')}` };
  });

  // Suma acumulada de palabras por día de juego (los días sin entrar no cuentan ni restan).
  let sum = 0;
  const points = state.days.filter(d => d.newWords > 0).map(d => ({ label: niceDate(d.date), value: (sum += d.newWords) }));

  const d = domains();
  const rows = [
    { emoji: '🧠', label: T('area_vocab'), value: d.vocab },
    { emoji: '📚', label: T('area_grammar'), value: d.grammar },
    { emoji: '🗣️', label: T('area_pron'), value: d.pron },
    { emoji: '✍️', label: T('area_writing'), value: d.writing },
  ];

  el.innerHTML = `${header(T('progress_title'), '📊')}
    <section class="stage progress">
      <div class="stats">
        <div class="stat s1"><b>${words}</b><span>${T('words')}</span></div>
        <div class="stat s2"><b>${sentences}</b><span>${T('sentences')}</span></div>
        <div class="stat s3"><b>${medals}</b><span>${T('medals')}</span></div>
      </div>

      <div class="panel">
        <h2>🧗 ${T('map_title')}</h2>
        ${routeMap(holds)}
        <p class="caption" id="caption">${esc(holds.find(h => h.status === 'current')?.tip || '')}</p>
        <div class="legend">${content.stages.map(s => `
          <span class="stage-chip st${s.n}${s.n <= crowned ? ' crowned' : ''}">${s.n <= crowned ? '👑' : esc(s.emoji)} ${esc(tt(s.name))}</span>`).join('')}</div>
      </div>

      <div class="panel">
        <h2>📈 ${T('chart_title')}</h2>
        ${points.length ? areaChart(points, t('words')) : `<p class="soon">${T('chart_empty')}</p>`}
      </div>

      <div class="panel">
        <h2>💪 ${T('areas_title')}</h2>
        ${domainBars(rows)}
      </div>

      <div class="panel">
        <h2>🏅 ${T('medals_title')}</h2>
        <div class="medals">${content.medals.map(m => state.medals[m.id]
          ? `<div class="medal got"><span class="m-emoji">${esc(m.emoji)}</span><b>${esc(tt(m.title))}</b><small>${niceDate(state.medals[m.id])}</small></div>`
          : `<div class="medal"><span class="m-emoji">❔</span><small>${esc(tt(m.desc))}</small></div>`).join('')}</div>
      </div>
    </section>`;

  wireChart(el);
  const caption = $('#caption', el);
  const tip = e => {
    const h = e.target.closest('.hold');
    if (h) caption.textContent = h.dataset.tip;
  };
  $('.route', el).addEventListener('pointerdown', tip);
  $('.route', el).addEventListener('focusin', tip);
}
