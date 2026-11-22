// EL ROCÓDROMO: entrenar sin límite con lo que ya sabe.
//
// No es el premio de consolación de cuando se acaban las palabras nuevas: está en el panel
// desde el primer día, al lado de "Aprender jugando", y es donde los escaladores se hacen
// fuertes. Aquí no entra temario nuevo (eso tiene su ritmo), pero no hay ningún techo:
// se juega todo lo que se quiera, y cuenta para la racha, los repasos y las medallas.
import { $, esc, pick } from '../core/util.js';
import { state } from '../core/store.js';
import { T, t } from '../core/i18n.js';
import { makeFreePlan, freeGames, record, recordFree } from '../core/session.js';
import { learnedWords } from '../core/path.js';
import { header, empty } from '../ui/layout.js';
import { chime, confetti, bubble } from '../ui/feedback.js';

const DESCANSO = 4;   // partidas entre una celebración y la siguiente

const marcador = () => `
  <div class="gym-score">
    <span class="gym-streak" id="streak">🔥 ${t('streak_now', { n: state.stats.streak })}</span>
    <span>🧗 ${t('free_today', { n: state.stats.freeGames })}</span>
  </div>`;

export default async function gym(el) {
  const top = header(T('gym_title'), '🧗');
  if (learnedWords().length < 3) { el.innerHTML = top + empty('🧗', 'gym_empty'); return; }

  let jugadas = 0;
  let anterior = null;
  bubble(T('gym_hi'), 3200);

  while (el.isConnected) {
    const plan = makeFreePlan();
    const posibles = freeGames(plan).filter(g => g !== anterior);
    const juego = pick(posibles.length ? posibles : freeGames(plan));
    if (!juego) { el.innerHTML = top + empty('🧗', 'gym_empty'); return; }
    anterior = juego;

    el.innerHTML = `${top}${marcador()}<section class="stage game-${juego.id}" id="stage"></section>`;
    const stage = $('#stage', el);
    const results = await juego.play(stage, plan);
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

export { marcador as gymScore };
void esc;
