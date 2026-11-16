// RINCÓN DE MAYORES: ajustes, voz, micrófono y copia de seguridad del progreso.
// Esta pantalla es para adultos y está siempre en español.
import { $, esc } from '../core/util.js';
import { content } from '../core/content.js';
import { state, save } from '../core/store.js';
import { speak, canSpeak, micSupported, voiceInfo, accentName } from '../core/speech.js';
import { exportProgress, readBackup, importProgress } from '../core/backup.js';
import { learnedWords, englishLevel, currentStage, leftToday, DAILY, NEW_WORDS } from '../core/path.js';
import { howMany } from '../ui/nextstep.js';
import { applyTheme } from '../core/theme.js';
import { go } from '../core/nav.js';
import { header } from '../ui/layout.js';
import { bubble } from '../ui/feedback.js';
import { cleanName } from './welcome.js';

const INSTALL = 'Android: Ajustes → Sistema → Idiomas → Síntesis de voz → Instalar datos de voz. Windows: Configuración → Hora e idioma → Voz → Agregar voces.';

// Qué voz se está usando y con qué acento. Las grafías están escritas para un acento concreto,
// así que aquí se avisa si la voz real no es la que se ha pedido.
function voiceReport(s) {
  if (!canSpeak()) return '<p class="note">Este navegador no puede leer en voz alta.</p>';
  const info = voiceInfo();
  const wanted = accentName(info.wanted);
  if (!info.known) {
    return `<p class="note"><b>Voz en uso: no se puede saber.</b> Este dispositivo no informa de qué voces tiene.
      La app pide acento ${wanted} (${esc(info.wanted)}); si esa voz no está instalada, el sistema puede usar otra
      sin avisar. Compruébalo de oído con «Probar la voz».</p>`;
  }
  if (!info.inUse) {
    return `<p class="note"><b>⚠️ Este dispositivo no tiene ninguna voz inglesa.</b> Para no enseñar una pronunciación
      equivocada, la app NO lee en voz alta hasta que instales una. ${INSTALL}</p>
      <label class="switch"><input type="checkbox" id="force"${s.forceVoice ? ' checked' : ''}>
      <span>He pulsado «Probar la voz» y suena inglés nativo: leer de todos modos</span></label>`;
  }
  const same = info.inUse.lang === info.wanted;
  const list = info.english.map(v => `${esc(v.name)} — ${accentName(v.lang)}`).join('<br>');
  return `<p class="note"><b>Voz en uso: ${esc(info.inUse.name)}</b><br>
      <b>Acento: ${accentName(info.inUse.lang)} (${esc(info.inUse.lang)})</b></p>
    ${same ? '' : `<p class="note"><b>⚠️ Has elegido acento ${wanted}, pero este dispositivo no tiene esa voz</b> y se está
      leyendo con acento ${accentName(info.inUse.lang)}. Las grafías («suena parecido a») están escritas para el
      acento elegido, así que algunas no coincidirán con lo que se oye. ${INSTALL}</p>`}
    <p class="note">Las pistas de «suena parecido a» están escritas para acento <b>británico</b>. «Probar la voz» dice
      «I», «car» y una frase: «I» tiene que sonar «ái», y en «car» no debe oírse la r final (si se oye, la voz es americana).</p>
    <p class="note">Voces inglesas en este dispositivo (${info.english.length}):<br>${list}</p>`;
}

export default function settings(el) {
  const s = state.settings;
  const left = leftToday();
  el.innerHTML = `${header('Rincón de mayores', '👨‍👩‍👧')}
    <section class="stage settings">
      <div class="panel">
        <h2>👧 Alumna</h2>
        <label class="field">Nombre <input id="name" type="text" maxlength="16" value="${esc(s.name)}"></label>
        <p class="note">Lleva ${learnedWords().length} de ${content.words.length} palabras. Etapa: ${esc(currentStage().name.es)}.
          Interfaz en inglés: ${englishLevel()} %.</p>
      </div>

      <div class="panel">
        <h2>🔊 Voz</h2>
        <label class="field">Acento
          <select id="voice">
            <option value="en-GB"${s.voice === 'en-GB' ? ' selected' : ''}>Británico (en-GB), recomendado</option>
            <option value="en-US"${s.voice === 'en-US' ? ' selected' : ''}>Americano (en-US)</option>
          </select></label>
        <label class="field">Velocidad
          <select id="rate">
            <option value="0.7"${s.rate <= 0.7 ? ' selected' : ''}>Lenta</option>
            <option value="0.85"${s.rate > 0.7 && s.rate < 1 ? ' selected' : ''}>Tranquila</option>
            <option value="1"${s.rate >= 1 ? ' selected' : ''}>Normal</option>
          </select></label>
        <button class="btn ghost" id="test">▶️ Probar la voz</button>
        <div id="voice-info"></div>
      </div>

      <div class="panel">
        <h2>🎤 Micrófono</h2>
        <label class="switch"><input type="checkbox" id="mic"${s.mic ? ' checked' : ''}${micSupported() ? '' : ' disabled'}>
          <span>Comparar su pronunciación con el micrófono</span></label>
        <p class="note">${micSupported()
          ? 'Aviso de privacidad: el reconocimiento de voz de Chrome envía el audio a Google para transcribirlo y necesita internet. Si lo dejas apagado, la app usa «escucha y repite» y no sale ningún dato de la tablet.'
          : 'Este navegador no tiene reconocimiento de voz. La app usa «escucha y repite».'}</p>
      </div>

      <div class="panel">
        <h2>🌙 Aspecto</h2>
        <label class="switch"><input type="checkbox" id="dark"${s.dark ? ' checked' : ''}><span>Modo oscuro</span></label>
      </div>

      <div class="panel">
        <h2>📅 Ritmo de aprendizaje</h2>
        <p class="note"><b>Cada partida enseña como mucho ${NEW_WORDS} palabras nuevas o 1 frase nueva.</b> Al día hay
          hasta ${DAILY.wordSessions} partidas con palabras nuevas (${DAILY.wordSessions * NEW_WORDS} palabras) y
          ${DAILY.sentenceSessions} con frase nueva. Hoy le quedan: <b>${esc(howMany(left.words, left.sentences) || 'nada nuevo; mañana hay más')}</b>.</p>
        <p class="note"><b>Por qué.</b> Lo que se aprende de golpe se olvida de golpe. Con pocas palabras al día, y
          haciéndolas volver en los juegos al cabo de 1, 2, 4, 8 y 16 días, se quedan. Si la app dejara aprender 40
          palabras una tarde, a la semana recordaría muy pocas y sentiría que no avanza.</p>
        <p class="note"><b>Cuando se acaba lo nuevo del día, el día no se acaba:</b> puede seguir jugando con lo que ya
          sabe (eso es justo el repaso que fija las palabras), practicar la voz y la escritura, mirar «Mis palabras» o
          ir a la canción. La app se lo dice así, sin tono de castigo. Si pregunta por qué no hay más palabras, la
          respuesta es: «porque así no se te olvidan, y mañana hay más».</p>
        <p class="note">El límite es deliberado y no se cambia desde la app.</p>
      </div>

      <div class="panel">
        <h2>💾 Copia del progreso</h2>
        <p class="note">El progreso se guarda solo en esta tablet. Si se borran los datos de Chrome, se pierde:
          exporta una copia de vez en cuando. ${state.lastExport ? `Última copia: ${esc(state.lastExport)}.` : 'Todavía no hay ninguna copia.'}</p>
        <div class="row">
          <button class="btn" id="export">⬇️ Exportar a archivo</button>
          <label class="btn ghost file">⬆️ Importar de archivo<input type="file" id="import" accept=".json,application/json" hidden></label>
        </div>
        <div id="confirm"></div>
      </div>

      <div class="panel">
        <h2>🔄 Actualizar contenido</h2>
        <p class="note">La app busca cambios sola cada vez que se abre con conexión. Si has publicado correcciones y
          no aparecen, pulsa aquí con wifi: descarga todo de nuevo. No toca el progreso.</p>
        <button class="btn ghost" id="update">🔄 Descargar la última versión</button>
      </div>
    </section>`;

  $('#name', el).onchange = e => { s.name = cleanName(e.target.value) || s.name; save(); location.reload(); };
  $('#voice', el).onchange = e => { s.voice = e.target.value; save(); go('settings'); };
  $('#rate', el).onchange = e => { s.rate = Number(e.target.value); save(); };
  $('#test', el).onclick = async () => {
    await speak('I', { force: true });
    await speak('Car. Hello! I can climb the mountain.', { force: true });
  };
  // La lista de voces llega con retraso: el informe se rellena ahora y cuando el navegador avise.
  const showVoice = () => {
    if (!el.isConnected) return window.removeEventListener('voices-ready', showVoice);
    $('#voice-info', el).innerHTML = voiceReport(s);
    if ($('#force', el)) $('#force', el).onchange = e => { s.forceVoice = e.target.checked; save(); };
  };
  showVoice();
  window.addEventListener('voices-ready', showVoice);
  $('#mic', el).onchange = e => { s.mic = e.target.checked; save(); };
  $('#dark', el).onchange = e => { s.dark = e.target.checked; save(); applyTheme(); };
  $('#export', el).onclick = () => { exportProgress(); bubble('Copia guardada en Descargas 💾'); };

  $('#update', el).onclick = async () => {
    if (!navigator.onLine) return bubble('Hace falta conexión a internet 📶');
    try {
      // Solo se borra la copia de archivos de la app; el progreso está en otro sitio (localStorage).
      for (const key of await caches.keys()) await caches.delete(key);
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
    } catch { /* aunque falle, la recarga pide los archivos a la red */ }
    location.hash = '#home';
    location.reload();
  };

  $('#import', el).onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const box = $('#confirm', el);
    try {
      const backup = await readBackup(file);
      // Importar sustituye lo que hay: se pide confirmación antes.
      box.innerHTML = `<p class="note"><b>La copia tiene ${backup.words} palabras${backup.exported ? ` (del ${esc(backup.exported)})` : ''}.</b>
        En esta tablet hay ${Object.keys(state.words).length}. Al importar se sustituye el progreso actual.</p>
        <div class="row"><button class="btn ghost" id="no">Cancelar</button><button class="btn" id="yes">Sí, importar</button></div>`;
      $('#no', box).onclick = () => { box.innerHTML = ''; };
      $('#yes', box).onclick = () => { importProgress(backup); location.hash = '#home'; location.reload(); };
    } catch {
      box.innerHTML = '<p class="note">Ese archivo no parece una copia de esta app. No se ha cambiado nada.</p>';
    }
  };
}
