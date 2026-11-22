// Actualizaciones de la app.
//
// Quien la usa es una niña: un botón de «hay una versión nueva, recarga» lo ignoraría.
// Así que la versión nueva se instala sola en segundo plano y se aplica en un momento
// seguro: al abrir la app, o al volver a ella, pero NUNCA en mitad de un juego.
//
// Sin conexión no pasa nada: la búsqueda falla en silencio y se reintenta la próxima vez.

let reg = null;
let pendiente = false;   // hay una versión nueva instalada, esperando su momento
let recargando = false;

// En mitad de una partida, o entrenando en el rocódromo, no se toca nada.
const ocupada = () => location.hash.startsWith('#play') || location.hash.startsWith('#gym');

function aplicar() {
  if (!pendiente || recargando || ocupada() || !reg?.waiting) return;
  recargando = true;
  reg.waiting.postMessage('SKIP_WAITING');  // al tomar el control, se recarga la página
}

function buscar() {
  if (reg && !document.hidden && navigator.onLine) reg.update().catch(() => {});
}

export async function initUpdates() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) location.reload();
  });

  try {
    reg = await navigator.serviceWorker.register('sw.js');
  } catch (e) {
    console.warn('Sin modo offline:', e);
    return;
  }

  // Versión que quedó esperando de la vez anterior: este es justo el momento de aplicarla.
  if (reg.waiting) { pendiente = true; aplicar(); }

  reg.addEventListener('updatefound', () => {
    const nuevo = reg.installing;
    if (!nuevo) return;
    nuevo.addEventListener('statechange', () => {
      // 'installed' habiendo ya un controlador = versión nueva lista. Sin controlador es
      // la primera instalación de todas y no hay nada que sustituir.
      if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
        pendiente = true;
        aplicar();  // si está jugando, se queda esperando a que termine
      }
    });
  });

  // Al volver a la app (desbloquear la tablet, cambiar de aplicación) se mira si hay
  // novedades; y al salir de un juego se aprovecha para aplicar lo que estuviera esperando.
  document.addEventListener('visibilitychange', () => { buscar(); aplicar(); });
  window.addEventListener('online', buscar);
  window.addEventListener('hashchange', aplicar);
  buscar();
}
