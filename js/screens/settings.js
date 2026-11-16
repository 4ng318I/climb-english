// RINCÓN DE MAYORES: ajustes, voz, micrófono y copia de seguridad del progreso.
// Esta pantalla es para adultos y está siempre en español.
import { $, esc } from '../core/util.js';
import { content } from '../core/content.js';
import { state, save } from '../core/store.js';
import { speak, canSpeak, englishVoiceName, micSupported } from '../core/speech.js';
import { exportProgress, readBackup, importProgress } from '../core/backup.js';
import { learnedWords, englishLevel, currentStage } from '../core/path.js';
import { applyTheme } from '../core/theme.js';
import { go } from '../core/nav.js';
import { header } from '../ui/layout.js';
import { bubble } from '../ui/feedback.js';
import { cleanName } from './welcome.js';

export default function settings(el) {
  const s = state.settings;
  const voice = englishVoiceName();
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
            <option value="en-GB"${s.voice === 'en-GB' ? ' selected' : ''}>Británico (en-GB)</option>
            <option value="en-US"${s.voice === 'en-US' ? ' selected' : ''}>Americano (en-US)</option>
          </select></label>
        <label class="field">Velocidad
          <select id="rate">
            <option value="0.7"${s.rate <= 0.7 ? ' selected' : ''}>Lenta</option>
            <option value="0.85"${s.rate > 0.7 && s.rate < 1 ? ' selected' : ''}>Tranquila</option>
            <option value="1"${s.rate >= 1 ? ' selected' : ''}>Normal</option>
          </select></label>
        <button class="btn ghost" id="test">▶️ Probar la voz</button>
        <p class="note">${!canSpeak() ? 'Este navegador no puede leer en voz alta.'
          : voice ? `Voz en uso: ${esc(voice)}.`
          : 'No veo ninguna voz inglesa en la lista. Pulsa «Probar la voz»: si suena con acento español, instala el inglés en Ajustes de Android → Sistema → Idiomas → Síntesis de voz.'}</p>
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
        <h2>💾 Copia del progreso</h2>
        <p class="note">El progreso se guarda solo en esta tablet. Si se borran los datos de Chrome, se pierde:
          exporta una copia de vez en cuando. ${state.lastExport ? `Última copia: ${esc(state.lastExport)}.` : 'Todavía no hay ninguna copia.'}</p>
        <div class="row">
          <button class="btn" id="export">⬇️ Exportar a archivo</button>
          <label class="btn ghost file">⬆️ Importar de archivo<input type="file" id="import" accept=".json,application/json" hidden></label>
        </div>
        <div id="confirm"></div>
      </div>
    </section>`;

  $('#name', el).onchange = e => { s.name = cleanName(e.target.value) || s.name; save(); location.reload(); };
  $('#voice', el).onchange = e => { s.voice = e.target.value; save(); go('settings'); };
  $('#rate', el).onchange = e => { s.rate = Number(e.target.value); save(); };
  $('#test', el).onclick = () => speak('Hello! I can climb the mountain.');
  $('#mic', el).onchange = e => { s.mic = e.target.checked; save(); };
  $('#dark', el).onchange = e => { s.dark = e.target.checked; save(); applyTheme(); };
  $('#export', el).onclick = () => { exportProgress(); bubble('Copia guardada en Descargas 💾'); };

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
