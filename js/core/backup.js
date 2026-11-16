// Exportar e importar el progreso a un archivo JSON.
import { state, save, replace } from './store.js';
import { dayKey } from './util.js';

export function exportProgress() {
  state.lastExport = dayKey();
  save();
  const data = { app: 'ingles-a1', exported: new Date().toISOString(), state };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `progreso-${(state.settings.name || 'copia').toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/gi, '-')}-${dayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Lee un archivo exportado. Devuelve un resumen, o lanza un error si no es válido.
export async function readBackup(file) {
  const data = JSON.parse(await file.text());
  const st = data && data.app === 'ingles-a1' ? data.state : null;
  if (!st || typeof st.words !== 'object' || st.version !== 1) throw new Error('formato');
  return { state: st, words: Object.keys(st.words).length, exported: (data.exported || '').slice(0, 10) };
}

export function importProgress(backup) {
  replace(backup.state);
}
