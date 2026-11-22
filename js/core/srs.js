// Repaso espaciado con 5 cajas. Un tropiezo baja una sola caja y nunca se enseña a la alumna.
//
// De paso se apunta lo que hace falta para saber si el ritmo diario le viene grande:
// cuántos repasos responde, cuántos acierta A LA PRIMERA de cada día, y cuántas palabras
// bajan de caja. Nada de esto se le enseña a ella.
import { dayKey, addDays } from './util.js';
import { state, today } from './store.js';

const GAPS = [0, 1, 2, 4, 8, 16]; // días hasta el siguiente repaso, según la caja

export function introduce(map, id) {
  if (map[id]) return map[id];
  const t = dayKey();
  map[id] = { box: 1, learned: t, due: addDays(t, 1), last: t, ok: 0, seen: 0, said: 0, written: 0 };
  return map[id];
}

// La caja solo se mueve una vez al día, aunque la palabra salga en varios juegos.
export function result(rec, ok) {
  if (!rec) return;
  const t = dayKey();
  const primeraDeHoy = rec.last !== t;
  const esRepaso = rec.learned !== t;   // lo aprendido hoy no cuenta como repaso
  rec.seen++;
  if (ok) rec.ok++;
  rec.last = t;

  if (esRepaso && primeraDeHoy) {
    const d = today();
    d.rev[0]++;
    if (ok) d.rev[1]++;
    state.stats.reviews++;
  }

  if (rec.moved === t || rec.learned === t) return; // el día que se aprende, se queda en la caja 1
  const antes = rec.box;
  rec.box = ok ? Math.min(5, rec.box + 1) : Math.max(1, rec.box - 1);
  if (rec.box < antes) today().lapses++;
  rec.moved = t;
  rec.due = addDays(t, GAPS[rec.box]);
}

// Ids que toca repasar hoy, primero los que llevan más tiempo esperando.
export function dueIds(map, limit) {
  const t = dayKey();
  return Object.keys(map)
    .filter(id => map[id].due <= t && map[id].learned !== t)
    .sort((a, b) => (map[a].due < map[b].due ? -1 : 1))
    .slice(0, limit);
}
