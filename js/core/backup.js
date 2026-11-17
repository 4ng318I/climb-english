// Copia del progreso: exportar e importar un archivo JSON.
//
// El archivo lleva el nombre de la app y la versión de esquema, para que no se pueda
// mezclar con el de otra app publicada en el mismo sitio (por ejemplo Deutsch_B2).
import { state, save, replace, migrate, APP, SCHEMA } from './store.js';
import { dayKey } from './util.js';

const slug = s => String(s || 'copia').toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/gi, '-').replace(/^-|-$/g, '');

export function exportProgress() {
  state.lastExport = dayKey();
  save();
  const data = { app: APP, schema: SCHEMA, exported: new Date().toISOString(), progress: state };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `climbenglish-${slug(state.settings.name)}-${dayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Saca el progreso del archivo y rechaza lo que no sea de esta app.
export function unwrap(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Ese archivo no contiene una copia de progreso.');
  if (typeof obj.app !== 'string') throw new Error('No reconozco el formato de ese archivo.');
  if (obj.app === 'ingles-a1') throw new Error('Ese archivo es de una versión de prueba anterior y ya no se puede importar.');
  if (obj.app !== APP) throw new Error(`Ese archivo es de otra app («${obj.app}»), no de Climb English.`);
  return obj.progress;
}

// Lee un archivo exportado. Devuelve un resumen, o lanza un error explicando qué pasa.
export async function readBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Ese archivo no es un JSON válido.');
  }
  const st = migrate(unwrap(data));
  return {
    state: st,
    words: Object.keys(st.words).length,
    sentences: Object.keys(st.sentences).length,
    name: st.settings?.name || '',
    exported: (data.exported || '').slice(0, 10),
  };
}

export function importProgress(backup) {
  replace(backup.state);
}
