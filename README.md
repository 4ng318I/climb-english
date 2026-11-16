<p align="center"><img src="assets/icon-192.png" width="120" alt="Icono de Climb English: una montaña con una bandera y el rótulo A1"></p>

# Climb English

Aplicación web para que una niña o un niño de unos 10 años aprenda inglés desde cero hasta
el nivel A1 **jugando**, con la escalada, las manualidades y la música como hilo conductor.

**Abrir la app:** https://4ng318i.github.io/climb-english/

- 325 palabras y 132 frases en 20 bloques, 14 reglas de gramática y 6 minijuegos.
- Sesiones de 5 a 10 minutos, con 3 palabras nuevas o 1 frase nueva como mucho.
- Nunca dice «está mal»: primero lo que salió bien y luego cómo queda todavía mejor.
- Sin deberes, sin rachas y sin contadores que castiguen.
- Funciona sin conexión una vez instalada. Sin cuentas, sin servidor y sin recoger datos:
  el nombre y el progreso se guardan solo en el dispositivo.
- HTML, CSS y JavaScript sin compilar y sin dependencias externas.

## Instalarla en una tablet Android

Hazlo tú la primera vez; después la niña o el niño ya puede usarla a solas.

1. Con la tablet conectada a la wifi, abre **Chrome** y entra en
   https://4ng318i.github.io/climb-english/
2. Toca el menú **⋮** (arriba a la derecha) y elige **Añadir a pantalla de inicio**
   (en algunas tablets pone **Instalar aplicación**). Confirma con **Instalar**.
3. En la pantalla de inicio aparece el icono de la montaña con la bandera. Ábrela desde ahí:
   se abre a pantalla completa, como cualquier otra aplicación.
4. La primera vez pregunta el nombre. Escribe el de quien va a usarla y toca **¡A escalar!**
5. Sin salir de la wifi, espera medio minuto en el panel para que termine de guardarse todo.
   A partir de aquí funciona **sin conexión**; solo necesitan internet los vídeos de las
   canciones y el micrófono.

### Comprueba la voz inglesa (importante)

La app lee en voz alta con la voz del propio Android, y esa voz es la referencia de
pronunciación. Compruébala antes de entregar la tablet:

1. En el panel, mantén pulsado **Mayores** (abajo a la derecha) dos segundos.
2. Toca **Probar la voz**. Dice «I. Hello! I can climb the mountain.» y tiene que sonar una
   voz inglesa nativa: la primera palabra debe sonar «ái», no «i».
3. Si suena con acento español o no suena: Ajustes de Android → Sistema → Idiomas →
   **Síntesis de voz** → motor de Google → **Instalar datos de voz** →
   *English (United Kingdom)*. Descárgala para que funcione también sin conexión.

Si el dispositivo no tiene ninguna voz inglesa, el navegador leería las palabras inglesas con
la voz española (y «I» sonaría «i»). Para no enseñar una pronunciación equivocada, en ese
caso la app **se queda callada** y muestra un aviso amarillo en el panel hasta que se instale
la voz. Lo mismo vale para probarla en un ordenador: en Windows, Configuración → Hora e
idioma → Voz → Agregar voces → Inglés (Reino Unido).

En ese mismo rincón puedes elegir acento británico o americano, la velocidad de la voz,
el modo claro u oscuro (viene en oscuro) y cambiar el nombre.

### El micrófono (opcional, apagado por defecto)

El reconocimiento de voz de Chrome **envía el audio a Google** para transcribirlo y necesita
internet. Por eso viene apagado: la sección de pronunciación funciona en modo
«escucha y repite», sin puntuar y sin que salga nada de la tablet. Si prefieres activarlo,
hazlo en **Mayores → Micrófono**; Chrome pedirá permiso la primera vez. Si el micro falla
o no hay conexión, la app vuelve sola a «escucha y repite».

### No perder el progreso

El progreso vive en la tablet. Si alguien borra los datos de Chrome o desinstala la app,
se pierde. En **Mayores → Copia del progreso**:

- **Exportar a archivo** descarga `progreso-NOMBRE-FECHA.json` en la carpeta Descargas.
- **Importar de archivo** recupera una copia (pide confirmación, porque sustituye lo que haya).

Exporta de vez en cuando y guarda el archivo fuera de la tablet. Esas copias contienen el
nombre: no las subas a este repositorio (el `.gitignore` ya las excluye).

### Recibir novedades

Cuando se publican cambios aquí, la tablet los recoge sola: cada vez que se abre la app con
conexión, pregunta al servidor si algún archivo ha cambiado. Si la wifi va lenta, esa vez
enseña la copia guardada y los cambios aparecen la siguiente vez que se abra.

Para forzarlo: **Mayores → Actualizar contenido → Descargar la última versión**, con wifi.
No toca el progreso. No uses «Borrar datos del sitio» de Chrome para esto: eso sí borra el
progreso.

## Cómo funciona por dentro

- **Sesión de juego:** presenta como mucho 3 palabras nuevas, o 1 frase nueva, y luego
  encadena 4 minijuegos que mezclan lo nuevo con repaso. Hay un tope de dos sesiones con
  novedades al día (6 palabras); después se puede seguir jugando con lo ya aprendido.
- **Orden:** las palabras salen en el orden en que están escritas en los archivos, bloque a
  bloque. Una frase solo aparece cuando ya se conocen todas las palabras de su lista `words`.
- **Repaso espaciado:** cada palabra vive en una caja de 1 a 5 y vuelve a los 1, 2, 4, 8 o
  16 días, siempre dentro de un juego. Un fallo baja una caja y no se muestra en ningún sitio.
- **Interfaz que se pasa al inglés:** va por etapas del camino. Etapa 1 = 0 %, etapa 2 = 15 %,
  etapa 3 = 30 %, etapa 4 = 50 %, etapa 5 = 70 %. Al coronar una etapa hay una celebración
  que enseña qué textos cambian. Los textos recién cambiados llevan el español en pequeño
  debajo las primeras veces.
- **Pronunciación:** el botón de escuchar es lo primero y lo más grande. La grafía española
  («uóte») es solo una ayuda visual y se presenta siempre como «suena parecido a».
- **Gramática:** una regla nueva al día como máximo; las ya vistas se pueden repetir siempre.
- **Canciones:** sin letras. Cada día que se abre una canción se desbloquean hasta 3 palabras.

## Añadir o corregir contenido sin tocar el código

Todo el contenido está en la carpeta `data/`. Después de editar, comprueba que no se ha
roto nada (hace falta Python):

```
python tools/validar_contenido.py
```

Avisa si falta una coma, un campo o si hay un identificador repetido.

### Corregir una grafía

Abre el archivo del bloque en `data/blocks/` y cambia el campo `pron` de la palabra o frase.

### Una canción nueva — `data/songs.json`

Copia un bloque entero y cambia los datos. **No pongas la letra**, solo de 5 a 8 palabras sueltas:

```json
{
  "id": "nombre-corto-sin-espacios",
  "title": "Título de la canción",
  "artist": "Artista",
  "youtube": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
  "words": [
    {"en": "dance", "es": "bailar", "pron": "dans", "emoji": "💃"}
  ]
}
```

El vídeo se muestra dentro de la app con `youtube-nocookie.com`. Muchos vídeos musicales no
permiten incrustarse: en ese caso, debajo está siempre el enlace
«¿No se ve el vídeo? Ábrelo en YouTube».

### Una palabra nueva — `data/blocks/NN-nombre.json`, lista `words`

```json
{"id": "w-kite", "en": "kite", "es": "cometa", "pron": "cáit", "pos": "nombre",
 "block": 19, "emoji": "🪁", "syllables": 1, "stress": 1, "theme": "manualidades"}
```

| Campo | Qué es |
|---|---|
| `id` | Único en toda la app. Usa `w-` + la palabra en minúsculas con guiones. |
| `en`, `es` | Inglés y español. |
| `pron` | Cómo suena en inglés británico, escrito en español. Ver «Cómo se escribe la grafía» más abajo. |
| `pos` | `nombre`, `acción`, `cualidad`, `número`, `palabrita`, `persona`, `saludo`, `pregunta` o `día`. Las cuatro primeras se usan como huecos en las frases tontas. |
| `block` | Número del bloque (el mismo que el archivo). |
| `emoji` | El dibujo. Procura que no se repita dentro del mismo bloque. |
| `syllables`, `stress` | Número de golpecitos de la palabra y cuál suena más fuerte (para el juego del tambor). |
| `theme` | Opcional: `escalada`, `manualidades` o `musica`. |

### Cómo se escribe la grafía (`pron`)

Se escribe para que una niña española lo lea tal cual, y sigue el inglés británico:

- La tilde marca dónde va el golpe de voz: `uóte` (water), `guitáa` (guitar).
- La **r detrás de vocal no suena**: en su lugar la vocal se alarga y se escribe doble:
  `caa` (car), `foo` (four), `doo` (door), `aa` (are).
- `ee` es la vocal de *bird*, *girl*, *word*: una «e» larga y cerrada, sin r (`beed`, `gueel`, `ueed`).
- Al final de palabra, `-er` suena como una «e» floja: `uóte`, `síste`, `tíche`.
- `z` es la zeta española (three = `zri`), `j` es una jota muy suave (hello = `jelóu`),
  `sh` como para pedir silencio, `y` como en «yo» dicho con fuerza (jump = `yamp`).
- Las letras mudas no se escriben: `cláim` (climb), `lísen` (listen), `nóu` (know), `uók` (walk).

### Una frase nueva — mismo archivo, lista `sentences`

```json
{"id": "s-i-fly-my-kite", "en": "I fly my kite.", "es": "Vuelo mi cometa.",
 "pron": "ái flái mái cáit", "block": 19, "emoji": "🪁",
 "words": ["w-i", "w-fly", "w-my", "w-kite"]}
```

`words` son los `id` de las palabras que hay que conocer antes de ver la frase; solo pueden
ser de ese bloque o de bloques anteriores. `grammar` (opcional) es el `id` de la regla que
ilustra. Si escribes `{name}` en una frase, la app pone ahí el nombre guardado en la tablet.

### Un bloque nuevo

1. Crea `data/blocks/21-lo-que-sea.json` copiando la forma de otro bloque.
2. Añádelo a la lista `blocks` de `data/blocks.json` con su `n`, `file`, `stage`, `title` y `emoji`.

### Lo demás

- `data/grammar.json` — reglas: la idea (sin tecnicismos), los ejemplos (`scenes`) y el
  juego de huecos (`play`; el hueco se escribe con tres guiones bajos `___`).
- `data/silly.json` — moldes de las frases tontas: palabras fijas y huecos por categoría.
- `data/medals.json` — medallas. `rule.type` puede ser `words`, `sentences`, `stages`,
  `grammar`, `said`, `written`, `silly`, `songs` o `sessions`.
- `data/ui-strings.json` — todos los textos de la interfaz en español e inglés. `from` es el
  porcentaje de inglés a partir del cual se muestra en inglés (15, 30, 50 o 70; con 100 se
  queda siempre en español).
- `data/blocks.json` — etapas y bloques. `english` es el porcentaje de inglés de cada etapa.

## Publicar los cambios

Desde la carpeta del proyecto, cada vez que cambies algo:

```
python tools/validar_contenido.py
git add -A
git commit -m "Corrijo grafías del bloque 4"
git push
```

GitHub Pages tarda uno o dos minutos en publicar. Para un retoque pequeño también puedes
editar el archivo en github.com (icono del lápiz) y pulsar **Commit changes**; en ese caso,
ejecuta `git pull` en el ordenador antes de volver a trabajar ahí.

## Probarla en el ordenador

La app necesita servirse por HTTP (abrir `index.html` con doble clic no funciona):

```
python -m http.server 8000
```

y abre `http://localhost:8000` en Chrome o Edge.

## Estructura del proyecto

```
index.html, manifest.json, sw.js     página, datos de instalación y modo sin conexión
css/        base.css · components.css · games.css
js/app.js                            arranque y navegación
js/core/    store (progreso) · backup · content · srs (repaso) · session · path (etapas y medallas)
            i18n (paso al inglés) · speech (voz y micro) · nav · theme · util
js/ui/      feedback (ánimos, confeti) · layout · charts (gráficas SVG) · keyboard
js/screens/ welcome · home · play · pronunciation · writing · grammar · song · progress · settings
js/games/   match · intruder · scramble · taps · memory · silly
data/       todo el contenido
assets/     iconos y la fuente Nunito (licencia SIL Open Font License)
tools/      validar_contenido.py
```

Todas las rutas son relativas, así que la app funciona igual en la raíz de un dominio que en
una subcarpeta como la de GitHub Pages. Si añades un archivo nuevo en `js/` o `css/`,
apúntalo en la lista `CORE` de `sw.js` para que también funcione sin conexión.

## Cosas que conviene saber

- La grafía de `pron` está escrita a mano y puede tener imprecisiones. La voz de la app es
  siempre la referencia.
- Los emojis se ven con el diseño de cada dispositivo; alguno muy reciente puede no existir
  en una tablet antigua. Si ves un cuadrado vacío, cambia ese emoji en el JSON.
