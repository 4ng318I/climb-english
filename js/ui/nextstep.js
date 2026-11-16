// "Tu siguiente paso": qué falta exactamente para el siguiente agarre y para subir de etapa.
// Siempre con números concretos ("te faltan 9 palabras"), nunca con porcentajes sueltos.
import { esc } from '../core/util.js';
import { content } from '../core/content.js';
import { state } from '../core/store.js';
import { T, t, tt } from '../core/i18n.js';
import {
  currentBlock, currentStage, blockProgress, stageProgress, stagesDone, atSummit, newToday, DAILY, NEW_WORDS,
} from '../core/path.js';

// "9 palabras y 2 frases", "1 palabra", "2 frases"...
export function howMany(words, sentences) {
  const parts = [];
  if (words > 0) parts.push(`${words} ${t(words === 1 ? 'w_one' : 'words')}`);
  if (sentences > 0) parts.push(`${sentences} ${t(sentences === 1 ? 's_one' : 'sentences')}`);
  return parts.join(` ${t('and')} `);
}

const meter = (emoji, label, value, total) => `
  <div class="meter">
    <div class="meter-top"><span>${emoji} ${label}</span><b>${value} ${t('of')} ${total}</b></div>
    <div class="bar-track"><div class="bar-fill ${value >= total ? 'full' : 'c2'}" style="width:${total ? Math.round(100 * value / total) : 0}%"></div></div>
  </div>`;

// Frase sobre lo que se puede descubrir hoy; si ya no queda nada, "vuelve mañana y seguimos".
export function todayLine() {
  const left = newToday();
  if (!left.anythingLeft) return '';
  return left.words || left.sentences ? T('today_more') : T('today_done');
}

// compact: solo las frases (para el final de una partida). Completo: con barras y la regla diaria.
export function nextStep({ compact = false } = {}) {
  if (atSummit()) return `<p class="next-line">🏔️ ${T('summit_done')}</p>`;

  const stage = currentStage();
  const sp = stageProgress(stage);
  const block = currentBlock();
  const bp = blockProgress(block);
  const lines = [];

  if (bp.words < bp.wordsTotal) {
    lines.push(`🪨 ${T('need_hold', { block: tt(block.title), what: howMany(bp.wordsTotal - bp.words, 0) })}`);
  }
  const missing = howMany(sp.wordsTotal - sp.words, sp.sentencesTotal - sp.sentences);
  if (missing) lines.push(`👑 ${T('need_stage', { stage: tt(stage.name), what: missing })}`);
  else if (stagesDone() > state.ui.stageSeen) lines.push(`🎉 ${T('stage_ready', { stage: tt(stage.name) })}`);

  const today = todayLine();
  const text = lines.map(l => `<p class="next-line">${l}</p>`).join('') +
    (today ? `<p class="next-line today">📅 ${today}</p>` : '');
  if (compact) return text;

  return `${text}
    <div class="meters">
      ${meter('🧠', esc(t('bar_words')), sp.words, sp.wordsTotal)}
      ${meter('💬', esc(t('bar_sentences')), sp.sentences, sp.sentencesTotal)}
    </div>
    <p class="note">${T('daily_rule', { words: DAILY.wordSessions * NEW_WORDS, sentences: DAILY.sentenceSessions, each: NEW_WORDS })}</p>`;
}

// Para el pie del panel: una sola línea corta.
export function shortGoal() {
  if (atSummit()) return '';
  const block = currentBlock();
  const bp = blockProgress(block);
  if (bp.words < bp.wordsTotal) return t('short_goal', { block: tt(block.title), what: howMany(bp.wordsTotal - bp.words, 0) });
  const sp = stageProgress(currentStage());
  const missing = howMany(sp.wordsTotal - sp.words, sp.sentencesTotal - sp.sentences);
  return missing ? t('short_goal', { block: tt(currentStage().name), what: missing }) : '';
}

export const stageCount = () => content.stages.length;
