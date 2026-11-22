// EL ROCÓDROMO: entrenar sin límite con lo que ya sabe.
//
// No es el premio de consolación de cuando se acaban las palabras nuevas: está en el panel
// desde el primer día, al lado de aprender, y es donde los escaladores se hacen fuertes.
// Aquí no entra temario nuevo (eso tiene su ritmo), pero no hay ningún techo.
//
// Aquí SÍ se puede elegir juego, porque no hay coste: se entrena lo que ya se sabe. En las
// sesiones de aprender la rotación sigue siendo fija, para que una palabra nueva se vea,
// se oiga, se escriba y se monte, y no solo se reconozca.
import { $, esc, pick } from '../core/util.js';
import { state } from '../core/store.js';
import { T, t } from '../core/i18n.js';
import { makeFreePlan, freeGames, record, recordFree, GAMES } from '../core/session.js';
import { learnedWords } from '../core/path.js';
import { go } from '../core/nav.js';
import { header, empty } from '../ui/layout.js';
import { chime, confetti, bubble } from '../ui/feedback.js';

const DESCANSO = 4;      // partidas entre una celebración y la siguiente
const SORPRESA = 'sorpresa';

const marcador = () => `
  <div class="gym-score">
    <span class="gym-streak">🔥 ${t('streak_now', { n: state.stats.streak })}</span>
    <span>🧗 ${t('free_today', { n: state.stats.freeGames })}</span>
  </div>`;

// Pantalla de entrada: sorpresa (lo que viene por defecto) o el juego que le apetezca.
function selector(el) {
  const plan = makeFreePlan();
  const puede = new Set(freeGames(plan).map(g => g.id));
  el.innerHTML = `${header(T('gym_title'), '🧗')}
    <section class="stage gym-pick">
      ${marcador()}
      <p class="howto">${T('gym_pick')}</p>
      <button class="play-big gym-big surprise" data-go="gym" data-arg="${SORPRESA}">
        <span class="pb-emoji">🎲</span><span class="pb-text">${T('gym_surprise')}</span>
        <span class="pb-sub">${esc(t('gym_surprise_sub'))}</span>
      </button>
      <p class="howto small">${T('gym_or')}</p>
      <div class="gym-games">${GAMES.map(g => `
        <button class="game-card${puede.has(g.id) ? '' : ' locked'}" data-go="gym" data-arg="${esc(g.id)}"
          ${puede.has(g.id) ? '' : 'disabled'}>
          <span class="gc-emoji">${g.icon}</span>
          <span>${T('game_' + g.id)}</span>
        </button>`).join('')}</div>
    </section>`;
}

export default async function gym(el, modo) {
  if (learnedWords().length < 3) {
    el.innerHTML = header(T('gym_title'), '🧗') + empty('🧗', 'gym_empty');
    return;
  }
  if (!modo) return selector(el);

  const elegido = GAMES.find(g => g.id === modo) || null;
  if (!elegido && modo !== SORPRESA) return go('gym');

  const top = header(T('gym_title'), '🧗');
  let jugadas = 0;
  let anterior = null;
  bubble(T(elegido ? 'gym_hi_one' : 'gym_hi'), 3200);

  while (el.isConnected) {
    const plan = makeFreePlan();
    const posibles = freeGames(plan);
    if (!posibles.length) { el.innerHTML = top + empty('🧗', 'gym_empty'); return; }

    let juego = elegido;
    if (!juego) {
      const sinRepetir = posibles.filter(g => g !== anterior);
      juego = pick(sinRepetir.length ? sinRepetir : posibles);
    } else if (!posibles.includes(juego)) {
      // Ese juego necesita material que ahora mismo no hay: se avisa y se vuelve a elegir.
      el.innerHTML = top + empty('🧗', 'gym_need_more');
      return;
    }
    anterior = juego;

    el.innerHTML = `${top}${marcador()}<section class="stage game-${juego.id}" id="stage"></section>`;
    const results = await juego.play($('#stage', el), plan);
    if (!el.isConnected) return;

    record(results);
    recordFree(juego.id);
    jugadas++;

    // Cada pocas partidas, un alto para celebrar y poder parar sin que lo parezca.
    if (jugadas % DESCANSO === 0) {
      el.innerHTML = `${top}
        <section class="stage">
          <div class="finish">
            <div class="big-emoji">💪</div>
            <h2>${T('gym_round', { n: jugadas })}</h2>
            <p>${T('gym_round_text', { streak: state.stats.bestStreak })}</p>
            ${marcador()}
            <div class="row">
              <button class="btn ghost" data-go="home">🏠 ${T('home')}</button>
              <button class="btn ghost" data-go="gym">🎲 ${T('gym_change')}</button>
              <button class="btn" id="more">🧗 ${T('gym_more')}</button>
            </div>
          </div>
        </section>`;
      chime();
      confetti(20);
      const seguir = await new Promise(resolve => {
        el.onclick = e => {
          if (e.target.closest('#more')) { el.onclick = null; resolve(true); }
          else if (e.target.closest('[data-go]')) { el.onclick = null; resolve(false); }
        };
      });
      if (!seguir || !el.isConnected) return;
    }
  }
}
