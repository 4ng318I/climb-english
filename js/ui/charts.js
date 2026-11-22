// Gráficas en SVG hecho a mano (sin librerías): palabras en el tiempo,
// dominio por área y el mapa de escalada hacia A1.
import { $, esc } from '../core/util.js';

// --- Palabras aprendidas en el tiempo (una sola serie: un solo color) ---
export function areaChart(points, unit) {
  const W = 600, H = 240, L = 44, R = 70, T = 18, B = 30;
  const pts = points.length === 1 ? [{ label: '', value: 0 }, ...points] : points;
  const max = Math.max(5, ...pts.map(p => p.value));
  const top = Math.ceil(max / 5) * 5;
  const x = i => L + (W - L - R) * (pts.length === 1 ? 0 : i / (pts.length - 1));
  const y = v => T + (H - T - B) * (1 - v / top);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const grid = [0, top / 2, top].map(v => `
    <line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>
    <text class="axis" x="${L - 8}" y="${y(v) + 5}" text-anchor="end">${Math.round(v)}</text>`).join('');
  const last = pts[pts.length - 1];
  const step = (W - L - R) / Math.max(1, pts.length - 1);
  const hits = pts.map((p, i) => p.label ? `
    <rect class="hit" x="${x(i) - step / 2}" y="${T}" width="${step}" height="${H - T - B}"
      data-tip="${esc(p.label)} · ${p.value} ${esc(unit)}" data-x="${x(i)}" data-y="${y(p.value)}"/>` : '').join('');
  const firstLabel = pts.find(p => p.label)?.label || '';
  return `
    <div class="chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(unit)}: ${last.value}">
        <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--violet)" stop-opacity=".45"/>
          <stop offset="1" stop-color="var(--violet)" stop-opacity=".04"/>
        </linearGradient></defs>
        ${grid}
        <path d="${area}" fill="url(#areaFill)"/>
        <path d="${line}" class="series"/>
        <circle class="marker" id="marker" cx="${x(pts.length - 1)}" cy="${y(last.value)}" r="7"/>
        <text class="value" x="${x(pts.length - 1) + 12}" y="${y(last.value) + 6}">${last.value}</text>
        <text class="axis" x="${x(pts.findIndex(p => p.label))}" y="${H - 8}" text-anchor="start">${esc(firstLabel)}</text>
        ${last.label !== firstLabel ? `<text class="axis" x="${x(pts.length - 1)}" y="${H - 8}" text-anchor="end">${esc(last.label)}</text>` : ''}
        ${hits}
      </svg>
      <div class="tip" hidden></div>
    </div>`;
}

// Toque o ratón sobre la gráfica: mueve el punto y enseña el dato de ese día.
export function wireChart(root) {
  const chart = $('.chart', root);
  if (!chart) return;
  const tip = $('.tip', chart), marker = $('#marker', chart);
  const show = e => {
    const hit = e.target.closest('.hit');
    if (!hit) return;
    marker.setAttribute('cx', hit.dataset.x);
    marker.setAttribute('cy', hit.dataset.y);
    tip.textContent = hit.dataset.tip;
    tip.hidden = false;
  };
  chart.addEventListener('pointermove', show);
  chart.addEventListener('pointerdown', show);
}

// --- Barras de la etapa: nombre, cuenta ("3 de 64") y barra. Sin porcentajes sueltos. ---
export function domainBars(rows, of) {
  return `<div class="bars">${rows.map((r, i) => {
    const pct = r.total ? Math.round(100 * r.value / r.total) : 0;
    return `
    <div class="bar-row">
      <span class="bar-label">${r.emoji} ${r.label}</span>
      <span class="bar-val">${r.value} ${esc(of)} ${r.total}</span>
      <div class="bar-track"><div class="bar-fill ${r.total && r.value >= r.total ? 'full' : 'c' + (i % 5 + 1)}" style="width:${r.value ? Math.max(3, pct) : 0}%"></div></div>
    </div>`;
  }).join('')}</div>`;
}

// --- Mapa del camino: una montaña con un agarre por bloque ---
// holds: [{ emoji, stage, status: 'done' | 'current' | 'locked', tip }]
// gecko: { from, to } en "agarres": 3.5 es a mitad de camino del agarre 3 al 4. La lagartija
// se dibuja en `from` y se desliza hasta `to`, para que el avance del día se VEA moverse.
export function routeMap(holds, gecko) {
  const W = 600, H = 760, n = holds.length;
  // Media anchura de la montaña a cada altura (se estrecha hacia la cima).
  const half = y => (y < 150 ? 80 * (y - 18) / 132 : y < 330 ? 80 + 90 * (y - 150) / 180 : 170 + 120 * (y - 330) / 418);
  const ZIGZAG = [-1, -0.33, 0.33, 1, 0.33, -0.33];
  const pos = holds.map((_, i) => {
    const y = 700 - (i / Math.max(1, n - 1)) * 570;
    const amp = Math.max(40, half(y) - 34);
    return { x: W / 2 + amp * ZIGZAG[i % ZIGZAG.length], y };
  });
  // Punto del sendero a una altura fraccionaria: entre un agarre y el siguiente.
  const punto = p => {
    const q = Math.max(0, Math.min(n - 1, p)), i = Math.floor(q), f = q - i;
    const a = pos[i], b = pos[Math.min(i + 1, n - 1)];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  };
  // El trozo de sendero ya subido, hasta donde esté la lagartija.
  const hasta = p => {
    const q = Math.max(0, Math.min(n - 1, p)), i = Math.floor(q);
    const g = punto(q);
    return pos.slice(0, i + 1).map((pt, j) => `${j ? 'L' : 'M'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .concat(`L${g.x.toFixed(1)},${g.y.toFixed(1)}`).join(' ');
  };
  const trail = pos.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const marks = holds.map((h, i) => `
    <g class="hold st${h.stage} ${h.status}" data-tip="${esc(h.tip)}" tabindex="0">
      <circle cx="${pos[i].x.toFixed(1)}" cy="${pos[i].y.toFixed(1)}" r="19"/>
      <text x="${pos[i].x.toFixed(1)}" y="${(pos[i].y + 7).toFixed(1)}" text-anchor="middle">${h.status === 'locked' ? '🔒' : esc(h.emoji)}</text>
    </g>`).join('');
  const g = gecko || { from: 0, to: 0 };
  const desde = punto(g.from), hacia = punto(g.to);
  return `
    <svg class="route" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa">
      <polygon class="peak" points="300,18 380,150 470,330 590,748 10,748 130,330 220,150"/>
      <polygon class="snow" points="300,18 337,79 314,68 297,88 266,74"/>
      <text x="${W / 2}" y="62" text-anchor="middle" font-size="30">🚩</text>
      <path class="trail" d="${trail}"/>
      <path class="trail climbed" id="climbed" d="${hasta(g.from)}" data-to="${hasta(g.to)}"/>
      ${marks}
      <text class="gecko" id="gecko" x="0" y="0" text-anchor="middle" aria-hidden="true"
        style="transform:translate(${(desde.x + 30).toFixed(1)}px, ${(desde.y - 12).toFixed(1)}px)"
        data-from="translate(${(desde.x + 30).toFixed(1)}px, ${(desde.y - 12).toFixed(1)}px)"
        data-to="translate(${(hacia.x + 30).toFixed(1)}px, ${(hacia.y - 12).toFixed(1)}px)">🦎</text>
    </svg>`;
}

// Suelta la lagartija: salta de donde estaba a donde está ahora. Se llama al abrir
// la pantalla, una sola vez; si no se ha movido nada, no hay nada que animar.
export function wireGecko(root) {
  const g = $('#gecko', root), c = $('#climbed', root);
  if (!g || !g.dataset.to || g.dataset.from === g.dataset.to) return;
  requestAnimationFrame(() => {
    g.classList.add('walking');
    void g.getBoundingClientRect();
    requestAnimationFrame(() => {
      g.style.transform = g.dataset.to;
      if (c && c.dataset.to) c.setAttribute('d', c.dataset.to);
    });
  });
}
