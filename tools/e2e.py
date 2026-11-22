"""Prueba de extremo a extremo en Chromium (Playwright).

Comprueba lo que de verdad importa cuando la app vive en una tablet junto a otras
apps publicadas en el mismo sitio de GitHub Pages:

  - la app se sirve desde una subcarpeta, como en 4ng318i.github.io/climb-english/;
  - solo escribe claves de localStorage con su prefijo;
  - su service worker no borra las cachés de otras apps del mismo origen;
  - la copia de seguridad lleva nombre de app y versión, y rechaza archivos ajenos;
  - se puede borrar el progreso y empezar de cero;
  - funciona sin conexión;
  - al publicar una versión nueva, la recoge sola al volver a abrirla.

Uso (desde la carpeta del proyecto):  python tools/e2e.py
Requiere:  pip install playwright  &&  python -m playwright install chromium
"""
import functools
import http.server
import json
import os
import pathlib
import random
import re
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "/climb-english/"          # subcarpeta, igual que en GitHub Pages
OTRA_CACHE = "deutschb2-v2"       # caché de otra app del mismo origen
OTRA_CLAVE = "deutschb2:progress"
SCHEMA = int(re.search(r"export const SCHEMA = (\d+);",
                       (ROOT / "js" / "core" / "store.js").read_text(encoding="utf-8")).group(1))
TOPE_PALABRAS = int(re.search(r"words: (\d+),",
                              (ROOT / "js" / "core" / "path.js").read_text(encoding="utf-8")).group(1))
sys.stdout.reconfigure(encoding="utf-8")

fallos = []


def check(cond, msg):
    print(("  OK    " if cond else "  FALLO ") + msg, flush=True)
    if not cond:
        fallos.append(msg)


def _watchdog():
    print("FALLO: la prueba se ha quedado colgada (mas de 6 minutos)", flush=True)
    os._exit(2)


class Handler(http.server.SimpleHTTPRequestHandler):
    """Sirve el proyecto bajo /climb-english/ y puede fingir una version nueva."""

    publicaciones = 0   # cada +1 es una version publicada en el servidor

    def log_message(self, *a):
        pass

    def translate_path(self, path):
        path = path.split("?")[0].split("#")[0]
        if path.startswith(BASE):
            path = "/" + path[len(BASE):]
        return super().translate_path(path)

    def do_GET(self):
        limpio = self.path.split("?")[0]
        if limpio == BASE + "__seed.html":
            # Pagina vacia del mismo origen, para sembrar datos antes de cargar la app.
            return self._enviar(b"<!doctype html><meta charset=utf-8><title>seed</title>", "text/html")
        if Handler.publicaciones and limpio.endswith("/sw.js"):
            texto = (ROOT / "sw.js").read_text(encoding="utf-8")
            v = int(re.search(r"const VERSION = (\d+);", texto).group(1))
            texto = texto.replace("const VERSION = %d;" % v, "const VERSION = %d;" % (v + Handler.publicaciones))
            return self._enviar(texto.encode("utf-8"), "text/javascript")
        return super().do_GET()

    def _enviar(self, body, tipo):
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


SEMBRAR = """() => {
  localStorage.setItem('deutschb2:progress', '{"v":1,"items":{"anf-01":{"box":3}}}');
  localStorage.setItem('deutschb2:settings', 'x');
  return caches.open('deutschb2-v2').then(c => c.put('/Deutsch_B2/index.html', new Response('Deutsch B2')));
}"""


SEMBRAR_PALABRAS = """(() => {
  // Progreso completo de una alumna que ya lleva unos dias: con esto se puede entrenar.
  const w = {}, ids = ['w-hello','w-i','w-am','w-you','w-are','w-goodbye','w-yes','w-no','w-please','w-name'];
  for (const id of ids) w[id] = { box: 2, learned: '2026-11-01', due: '2026-11-05',
    last: '2026-11-02', ok: 3, seen: 4, said: 0, written: 0 };
  localStorage.setItem('climbenglish:progress', JSON.stringify({
    v: 2, created: '2026-11-01',
    settings: { name: 'Alumna', dark: true, mic: false, voice: 'en-GB', rate: 0.85, forceVoice: false },
    words: w,
    sentences: { 's-hello-i-am': { box: 2, learned: '2026-11-01', due: '2026-11-05',
      last: '2026-11-02', ok: 2, seen: 3 } },
    grammar: {}, songs: {}, days: [], medals: {},
    stats: { sessions: 4, silly: 0, said: 0, written: 0, reviews: 0, freeGames: 0,
             perfect: 0, streak: 0, bestStreak: 0, games: {} },
    ui: { flipped: {}, stageSeen: 0, rot: 0, lastNew: 'words', blocksSeen: [] },
    lastVisit: '2026-11-02', lastExport: null,
  }));
})();"""


def claves(page):
    return sorted(page.evaluate("() => Object.keys(localStorage)"))


def caches_de(page):
    return sorted(page.evaluate("async () => await caches.keys()"))


def sw_listo(page):
    page.wait_for_function("() => navigator.serviceWorker.controller !== null", timeout=30000)


def entrar(page, url, nombre="Alumna"):
    """Pasa la bienvenida (nombre + explicacion del ritmo) hasta el panel."""
    page.goto(url)
    page.wait_for_selector("#who, .play-big", timeout=25000)
    if page.locator("#who").count():          # bienvenida: solo la primera vez
        page.fill("#who", nombre)
        page.click("#start")
        page.wait_for_selector("#go")
        page.click("#go")
    page.wait_for_selector(".play-big", timeout=25000)


# Un progreso REAL del esquema 1: sin los contadores nuevos, con medallas conseguidas,
# palabras en varias cajas y días jugados. Es lo que tiene la tablet antes de actualizarse.
PROGRESO_V1 = {
    "v": 1,
    "created": "2026-11-10",
    "settings": {"name": "Alumna", "dark": True, "mic": False, "voice": "en-GB",
                 "rate": 0.85, "forceVoice": False},
    "words": {
        "w-hello": {"box": 5, "learned": "2026-11-10", "due": "2026-12-01", "last": "2026-11-15",
                    "ok": 9, "seen": 11, "said": 3, "written": 2, "moved": "2026-11-15"},
        "w-i":     {"box": 3, "learned": "2026-11-10", "due": "2026-11-23", "last": "2026-11-19",
                    "ok": 5, "seen": 7, "said": 2, "written": 0},
        "w-am":    {"box": 1, "learned": "2026-11-19", "due": "2026-11-20", "last": "2026-11-19",
                    "ok": 1, "seen": 3, "said": 0, "written": 1},
        "w-you":   {"box": 4, "learned": "2026-11-11", "due": "2026-11-27", "last": "2026-11-19",
                    "ok": 6, "seen": 6, "said": 1, "written": 0},
        "w-are":   {"box": 2, "learned": "2026-11-18", "due": "2026-11-21", "last": "2026-11-19",
                    "ok": 2, "seen": 4, "said": 0, "written": 0},
    },
    "sentences": {
        "s-hello-i-am": {"box": 3, "learned": "2026-11-12", "due": "2026-11-24",
                         "last": "2026-11-20", "ok": 4, "seen": 5},
        "s-my-name-is": {"box": 1, "learned": "2026-11-20", "due": "2026-11-21",
                         "last": "2026-11-20", "ok": 1, "seen": 1},
    },
    "grammar": {"g-i-am": {"seen": "2026-11-14", "plays": 2}},
    "songs": {"happy": {"unlocked": 3, "day": "2026-11-20"}},
    "days": [
        {"date": "2026-11-15", "newWords": 6, "newSentences": 2, "wordSessions": 2,
         "sentenceSessions": 2, "minutes": 9, "grammar": 1},
        {"date": "2026-11-19", "newWords": 3, "newSentences": 1, "wordSessions": 1,
         "sentenceSessions": 1, "minutes": 7, "grammar": 0},
        {"date": "2026-11-20", "newWords": 6, "newSentences": 2, "wordSessions": 2,
         "sentenceSessions": 2, "minutes": 12, "grammar": 1},
    ],
    # La última no existe en el catálogo: una medalla ganada no se puede perder ni aunque
    # desaparezca de data/medals.json.
    "medals": {"first-word": "2026-11-10", "words-10": "2026-11-12", "stage-1": "2026-11-16",
               "medalla-retirada": "2026-11-17"},
    "stats": {"sessions": 12, "silly": 3, "said": 17, "written": 8},
    "ui": {"flipped": {"great": 3}, "stageSeen": 1, "rot": 4, "lastNew": "words",
           "blocksSeen": [1]},
    "lastVisit": "2026-11-21",
    "lastExport": "2026-11-18",
}

NUEVOS_EN_STATS = ["reviews", "freeGames", "perfect", "streak", "bestStreak", "games"]
# La app apunta la visita de hoy al abrirse: ese campo SI puede cambiar, es su trabajo.
CAMBIAN_A_PROPOSITO = {"v", "lastVisit", "days"}
NUEVOS_EN_DIA = ["rev", "lapses", "free"]


def diferencias(viejo, nuevo, ruta=""):
    """Todo lo que había en el progreso viejo tiene que seguir igual en el nuevo."""
    fallos = []
    if isinstance(viejo, dict):
        if not isinstance(nuevo, dict):
            return ["%s: ya no es un objeto" % ruta]
        for k, v in viejo.items():
            if k not in nuevo:
                fallos.append("%s.%s: ha desaparecido" % (ruta, k))
            else:
                fallos += diferencias(v, nuevo[k], "%s.%s" % (ruta, k))
    elif isinstance(viejo, list):
        if not isinstance(nuevo, list) or len(nuevo) != len(viejo):
            return ["%s: la lista ha cambiado de tamano" % ruta]
        for i, v in enumerate(viejo):
            fallos += diferencias(v, nuevo[i], "%s[%d]" % (ruta, i))
    elif viejo != nuevo:
        fallos.append("%s: %r -> %r" % (ruta, viejo, nuevo))
    return fallos


def comparar(viejo, nuevo):
    """Todo lo de antes sigue igual. Los dias se comparan por fecha: pueden anadirse nuevos,
    pero ninguno de los de antes puede desaparecer ni cambiar."""
    fallos = diferencias({k: v for k, v in viejo.items() if k not in CAMBIAN_A_PROPOSITO}, nuevo)
    for d in viejo["days"]:
        igual = next((x for x in nuevo["days"] if x["date"] == d["date"]), None)
        if igual is None:
            fallos.append("days[%s]: ha desaparecido" % d["date"])
        else:
            fallos += diferencias(d, igual, "days[%s]" % d["date"])
    return fallos


def prueba_tandas(navegador, url):
    """Lo nuevo del dia tiene que alcanzarse sin salir ni acertar la secuencia buena."""
    print("Llegar a todo lo nuevo del dia")
    ctx = navegador.new_context(reduced_motion="reduce")
    page = ctx.new_page()
    errores = []
    page.on("pageerror", lambda e: errores.append(str(e)))
    entrar(page, url)

    boton = page.inner_text(".big-row .play-big").replace(chr(10), " ")
    check("lo nuevo" in boton.lower(), "el boton grande dice lo que da: %r" % boton[:60])
    promete = page.inner_text(".play-big .pb-sub")
    page.click(".big-row [data-go='play']")

    SEL = (".stage .btn.next, .stage #seguir, .stage .tile:not(.done), .stage .piece, "
           ".stage .mcard:not(.done), .stage #drum, .stage .chip, .stage .dot, .stage #ok, .stage #go")
    puentes = 0
    for _ in range(2000):
        if page.locator(".finish:not(.bridge):not(.crown)").count():
            break
        if page.locator(".bridge").count() and not page.locator(".bridge.visto").count():
            puentes += 1
            page.evaluate("() => document.querySelector('.bridge').classList.add('visto')")
            check(page.locator(".bridge #seguir").count() == 1 and page.locator(".bridge #parar").count() == 1,
                  "el puente %d ofrece seguir y parar" % puentes)
        loc = page.locator(SEL)
        n = loc.count()
        if not n:
            page.wait_for_timeout(250)
            continue
        try:
            loc.nth(random.randrange(n)).click(timeout=1200)
        except Exception:
            pass
        page.wait_for_timeout(70)

    check(puentes >= 1, "aparece el puente entre tandas (%d)" % puentes)
    fin = page.evaluate("() => JSON.parse(localStorage.getItem('climbenglish:progress'))")
    check(len(fin["words"]) == TOPE_PALABRAS,
          "se llega a las %d palabras nuevas del dia (%d)" % (TOPE_PALABRAS, len(fin["words"])))
    check(len(fin["sentences"]) >= 1, "y a la frase nueva (%d)" % len(fin["sentences"]))
    check("%d palabras" % TOPE_PALABRAS in promete, "el panel prometia %r y se ha cumplido" % promete)

    page.goto(url + "#home")
    page.reload()
    page.wait_for_selector(".play-big", timeout=25000)
    ahora = page.inner_text(".big-row .play-big").replace(chr(10), " ")
    check("epasar" in ahora, "cuando ya no queda nada nuevo, el boton cambia: %r" % ahora[:60])
    check(not errores, "sin errores de JavaScript: %s" % errores[:2])
    ctx.close()
    print("")


def prueba_gym(navegador, url):
    """El rocodromo: entrenar sin limite con lo que ya sabe."""
    print("El rocodromo")
    ctx = navegador.new_context()
    # Se siembra antes de que arranque la app, para que ningun guardado anterior lo pise.
    ctx.add_init_script(SEMBRAR_PALABRAS)
    page = ctx.new_page()
    errores = []
    page.on("pageerror", lambda e: errores.append(str(e)))

    page.goto(url)
    page.wait_for_selector(".play-big", timeout=25000)
    botones = page.locator(".big-row .play-big").count()
    check(botones == 2, "el panel abre con DOS botones grandes: aprender y entrenar (%d)" % botones)
    check(page.locator(".big-row [data-go='gym']").count() == 1,
          "el del rocodromo esta al lado del de aprender, no escondido en un rincon")

    antes = page.evaluate("() => JSON.parse(localStorage.getItem('climbenglish:progress')).stats")
    page.click(".big-row [data-go='gym']")
    page.wait_for_selector(".gym-pick", timeout=25000)
    check(True, "el rocodromo abre con el selector de juego")
    check(page.locator(".gym-pick .surprise").count() == 1, "Sorpresa es la opcion grande por defecto")
    tarjetas = page.locator(".gym-pick .game-card").count()
    check(tarjetas == 6, "y debajo estan los 6 minijuegos para elegir (%d)" % tarjetas)

    # Elegir un juego concreto: el de emparejar
    page.click(".gym-pick .game-card[data-arg='match']")
    page.wait_for_selector(".game-match .tile", timeout=25000)
    check(page.evaluate("() => location.hash") == "#gym/match", "elegir un juego lleva a ese juego")
    page.wait_for_selector(".stage .tile, .stage .piece, .stage .mcard, .stage #drum, .stage .chip",
                           timeout=25000)

    # Jugar "a lo loco": se pulsa un elemento al azar de los que haya, hasta cerrar una
    # partida. Al azar y no siempre el primero, porque en el de emparejar hay que alternar.
    SELECTOR = (".stage .tile:not(.done), .stage .piece, .stage .mcard:not(.done), "
                ".stage #drum, .stage .chip, .stage .dot, .stage #ok, .stage .btn")
    for _ in range(200):
        objetivo = page.locator(SELECTOR)
        n = objetivo.count()
        if not n:
            page.wait_for_timeout(300)
            continue
        try:
            objetivo.nth(random.randrange(n)).click(timeout=1500)
        except Exception:
            pass
        page.wait_for_timeout(150)
        hechas = page.evaluate("() => JSON.parse(localStorage.getItem('climbenglish:progress')).stats.freeGames")
        if hechas > antes["freeGames"]:
            break
    page.wait_for_timeout(1500)

    despues = page.evaluate("() => JSON.parse(localStorage.getItem('climbenglish:progress')).stats")
    check(despues["freeGames"] > antes["freeGames"],
          "las partidas del rocodromo se apuntan (%d -> %d)" % (antes["freeGames"], despues["freeGames"]))
    check(len(despues["games"]) >= 1, "queda registrado que minijuego se ha probado")
    check(despues["reviews"] >= antes["reviews"], "entrenar cuenta como repaso de verdad")
    dia = page.evaluate("() => JSON.parse(localStorage.getItem('climbenglish:progress')).days.at(-1)")
    check(bool(dia) and dia.get("free", 0) >= 1, "y se apunta en el diario del dia: %s" % (dia or "sin dia"))
    palabras = page.evaluate("() => Object.keys(JSON.parse(localStorage.getItem('climbenglish:progress')).words).length")
    check(palabras == 10, "entrenar NO da palabras nuevas: siguen siendo %d" % palabras)
    check(page.evaluate("() => location.hash") == "#gym/match", "sigue en el juego elegido, no la echa fuera")
    check(list(despues["games"]) == ["match"], "y solo ha jugado al que eligio: %s" % list(despues["games"]))

    page.goto(url + "#progress")
    page.reload()
    page.wait_for_selector(".progress", timeout=25000)
    check(page.locator(".gym-panel").count() == 1, "el rocodromo tiene su propio panel en Mi progreso")
    check(not errores, "sin errores de JavaScript en el rocodromo: %s" % errores[:2])
    ctx.close()
    print("")


def prueba_lagartija(navegador, url):
    """La lagartija del mapa: se desplaza por el tramo segun lo que lleva del bloque."""
    print("La lagartija del mapa")
    # El guion de siembra corre en CADA navegacion, asi que recargar borraba lo que el
    # test iba aprendiendo. Aqui se siembra solo la primera vez, como en la tablet.
    semilla = SEMBRAR_PALABRAS.replace("(() => {", "(() => { if (localStorage.getItem('climbenglish:progress')) return;", 1)
    ctx = navegador.new_context()
    ctx.add_init_script(semilla)        # 10 palabras del bloque 1, que tiene 16
    page = ctx.new_page()
    errores = []
    page.on("pageerror", lambda e: errores.append(str(e)))

    leer = lambda: page.evaluate(
        "() => JSON.parse(localStorage.getItem('climbenglish:progress')).stats.geckoAt")
    # Donde esta pintada de verdad. El atributo salta al instante; lo que se desliza es esto.
    donde = lambda: page.evaluate(
        "() => getComputedStyle(document.querySelector('#gecko')).transform")
    meta = lambda: page.evaluate("() => document.querySelector('#gecko').dataset.to")
    anda = lambda: page.evaluate(
        "() => document.querySelector('#gecko').classList.contains('walking')")

    def aprende(ids, dia):
        """Mete palabras como si las hubiera aprendido otro dia, y recarga."""
        guion = ("(() => { const K = 'climbenglish:progress';"
                 " const p = JSON.parse(localStorage.getItem(K) || 'null'); if (!p) return;"
                 " for (const id of " + json.dumps(ids) + ")"
                 "   p.words[id] = { box: 1, learned: " + json.dumps(dia) + ","
                 "     due: " + json.dumps(dia) + ", last: " + json.dumps(dia) + ","
                 "     ok: 1, seen: 1, said: 0, written: 0 };"
                 " localStorage.setItem(K, JSON.stringify(p)); })();")
        ctx.add_init_script(guion)
        page.reload()
        page.wait_for_selector(".route #gecko", timeout=25000)

    def xy(v):
        """Saca los dos numeros de un matrix(...) o de un translate(...px, ...px)."""
        n = [float(x) for x in re.findall(r"-?\d+\.?\d*", v)]
        return (round(n[-2], 1), round(n[-1], 1))

    def hasta_quieta(limite=60):
        """Sigue la lagartija hasta que para. Devuelve las posiciones por las que pasa."""
        vistas, quieta = [], 0
        for _ in range(limite):
            v = donde()
            if not vistas or vistas[-1] != v:
                vistas.append(v)
                quieta = 0
            else:
                quieta += 1
                if len(vistas) > 1 and quieta >= 3:
                    break
            page.wait_for_timeout(100)
        return vistas

    page.goto(url + "#progress")
    page.wait_for_selector(".route #gecko", timeout=25000)
    check(page.locator(".route #gecko").count() == 1, "hay una sola lagartija, y va en el sendero")
    check(page.locator(".hold .gecko").count() == 0, "ya no cuelga del agarre")
    check(page.locator(".route #climbed").count() == 1, "y detras lleva el sendero ya subido")

    # El progreso sembrado no traia geckoAt: sale de abajo y tiene tramo que recorrer.
    paso = hasta_quieta()
    check(anda(), "arranca con camino que hacer, no pegada a su sitio")
    check(len(paso) >= 3,
          "y se DESLIZA: pasa por %d posiciones, no da un salto seco" % len(paso))
    check(xy(paso[-1]) == xy(meta()),
          "hasta plantarse donde le toca: %s (meta %s)" % (xy(paso[-1]), xy(meta())))

    uno = leer()
    check(0 < uno < 1, "queda a medio tramo, no pegada al agarre: %.3f" % uno)
    check(abs(uno - 10 / 16) < 0.01,
          "y a la altura que le toca: 10 de 16 palabras del bloque = %.3f" % uno)

    # Volver a abrir el mismo dia, sin aprender nada: se queda quieta donde estaba.
    page.goto(url + "#home")
    page.goto(url + "#progress")
    page.wait_for_selector(".route #gecko", timeout=25000)
    check(not anda(), "al volver sin aprender nada se queda quieta, sin salto raro")
    check(abs(leer() - uno) < 0.001, "y no se mueve sola: %.3f" % leer())

    # Otro dia, tres palabras nuevas: tiene que volver a moverse, y un trozo que se vea.
    aprende(["w-good", "w-my", "w-friend"], "2026-11-03")
    check(anda(), "con tres palabras mas vuelve a tener camino que hacer")
    paso2 = hasta_quieta()
    check(len(paso2) >= 3, "y se vuelve a deslizar (%d posiciones)" % len(paso2))
    dos = leer()
    check(dos > uno, "sube: %.3f -> %.3f" % (uno, dos))
    check(abs(dos - 13 / 16) < 0.01, "13 de 16 palabras del bloque = %.3f" % dos)

    # Cerrar el bloque la deja justo en el agarre siguiente, no a medias.
    aprende(["w-thank-you", "w-morning", "w-night"], "2026-11-04")
    hasta_quieta()
    cerrado = leer()
    check(abs(cerrado - 1) < 0.001, "al cerrar el bloque llega justo al agarre 2: %.3f" % cerrado)
    check(page.locator(".hold.done").count() >= 1, "y el agarre queda marcado como hecho")

    check(not errores, "sin errores de JavaScript en el mapa: %s" % errores[:2])
    ctx.close()
    print("")


def prueba_migracion(navegador, url):
    """Actualiza una tablet con progreso del esquema 1 y comprueba que no se pierde nada."""
    print("Actualizacion de una tablet con progreso guardado (esquema 1 -> 2)")
    ctx = navegador.new_context()
    page = ctx.new_page()
    errores = []
    page.on("pageerror", lambda e: errores.append(str(e)))

    page.goto(url + "__seed.html")
    page.evaluate("p => localStorage.setItem('climbenglish:progress', JSON.stringify(p))", PROGRESO_V1)
    antes_texto = page.evaluate("() => localStorage.getItem('climbenglish:progress')")

    page.goto(url)                      # aqui se actualiza sola
    page.wait_for_selector(".play-big", timeout=25000)
    nuevo = page.evaluate("() => JSON.parse(localStorage.getItem('climbenglish:progress'))")

    check(nuevo["v"] == SCHEMA, "el progreso queda en el esquema %d" % SCHEMA)
    difs = comparar(PROGRESO_V1, nuevo)
    check(not difs, "no se pierde ni cambia nada de lo anterior%s" % ("" if not difs else ": " + "; ".join(difs[:4])))

    check(all(k in nuevo["stats"] for k in NUEVOS_EN_STATS), "aparecen los contadores nuevos de stats")
    check(all(nuevo["stats"][k] == 0 for k in NUEVOS_EN_STATS if k != "games"),
          "los contadores nuevos empiezan en cero, no dan error")
    check(all(all(k in d for k in NUEVOS_EN_DIA) for d in nuevo["days"]),
          "los dias antiguos reciben los contadores nuevos")
    check(all(d["rev"] == [0, 0] and d["lapses"] == 0 for d in nuevo["days"]),
          "y empiezan a contar hoy, sin inventarse datos de los dias pasados")

    check(sorted(nuevo["medals"]) == sorted(PROGRESO_V1["medals"]), "estan TODAS las medallas conseguidas")
    check(nuevo["medals"].get("medalla-retirada") == "2026-11-17",
          "una medalla que ya no esta en el catalogo tampoco se pierde")
    page.goto(url + "#progress")
    page.wait_for_selector(".medals", timeout=20000)
    ganadas = page.locator(".medal.got").count()
    check(ganadas >= 4, "las 4 medallas se siguen viendo en Mi progreso (%d)" % ganadas)

    copias = page.evaluate("() => Object.keys(localStorage).filter(k => k.startsWith('climbenglish:backup'))")
    check("climbenglish:backup" in copias, "se ha guardado una copia de seguridad")
    copia = page.evaluate("() => JSON.parse(localStorage.getItem('climbenglish:backup'))")
    check(copia["texto"] == antes_texto, "la copia es exactamente el progreso de antes de actualizar")
    check("formato 1" in copia["motivo"], "y dice por que se hizo: %r" % copia["motivo"])

    page.goto(url + "#settings")
    page.wait_for_selector(".settings", timeout=20000)
    check(page.locator("[data-restore]").count() >= 1, "la copia se puede recuperar desde Mayores")

    # Volver a abrir no vuelve a migrar ni pierde nada.
    page.goto(url)
    page.wait_for_selector(".play-big", timeout=25000)
    otra = page.evaluate("() => JSON.parse(localStorage.getItem('climbenglish:progress'))")
    check(not comparar(PROGRESO_V1, otra), "al abrirla de nuevo sigue todo en su sitio")
    check(not errores, "sin errores de JavaScript durante la actualizacion: %s" % errores[:2])
    ctx.close()
    print("")


def main():
    wd = threading.Timer(360, _watchdog)
    wd.daemon = True
    wd.start()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = "http://127.0.0.1:%d%s" % (srv.server_address[1], BASE)
    print("Sirviendo %s en %s\n" % (ROOT.name, url))

    with sync_playwright() as pw:
        navegador = pw.chromium.launch()

        solo = None
        for a in sys.argv[1:]:
            if a.startswith('--solo='):
                solo = a.split('=', 1)[1]
        if solo:
            sueltas = {'tandas': prueba_tandas, 'gym': prueba_gym,
                       'lagartija': prueba_lagartija, 'migracion': prueba_migracion}
            if solo not in sueltas:
                print('--solo admite: %s' % ', '.join(sorted(sueltas)))
                return 2
            sueltas[solo](navegador, url)
            navegador.close()
            srv.shutdown()
            wd.cancel()
            print('%d fallos.' % len(fallos) if fallos else 'Todo correcto.')
            return 1 if fallos else 0

        ctx = navegador.new_context(accept_downloads=True)
        page = ctx.new_page()
        errores = []
        page.on("pageerror", lambda e: errores.append(str(e)))
        # Los fallos de red son de la prueba sin conexion, no de la app.
        de_red = lambda t: "ERR_" in t or "Failed to load resource" in t
        page.on("console", lambda m: errores.append(m.text) if m.type == "error" and not de_red(m.text) else None)

        prueba_migracion(navegador, url)

        print("Convivencia con otra app del mismo origen")
        page.goto(url + "__seed.html")
        page.evaluate(SEMBRAR)
        page.goto(url)
        sw_listo(page)
        page.wait_for_timeout(800)
        check(OTRA_CACHE in caches_de(page), "la cache de la otra app sigue ahi tras activarse el service worker")
        check(OTRA_CLAVE in claves(page), "los datos de la otra app siguen en localStorage")
        propias = [k for k in caches_de(page) if k.startswith("climbenglish-")]
        check(len(propias) == 1, "la app tiene una sola cache propia: %s" % propias)

        print("\nPrefijo propio en las claves")
        page.wait_for_selector("#who", timeout=20000)
        page.fill("#who", "Alumna")
        page.click("#start")
        page.wait_for_selector("#go")
        page.click("#go")
        page.wait_for_selector(".play-big", timeout=20000)
        nuestras = [k for k in claves(page) if not k.startswith("deutschb2:")]
        check(all(k.startswith("climbenglish:") for k in nuestras) and "climbenglish:progress" in nuestras,
              "todas sus claves llevan su prefijo: %s" % nuestras)
        guardado = page.evaluate("() => JSON.parse(localStorage.getItem('climbenglish:progress'))")
        check(guardado.get("v") == SCHEMA, "el progreso lleva version de esquema v=%s" % guardado.get("v"))
        check(guardado["settings"]["name"] == "Alumna", "el nombre se ha guardado")

        print("\nCopia de seguridad")
        page.goto(url + "#settings")
        page.wait_for_selector("#export")
        with page.expect_download() as dl:
            page.click("#export")
        fichero = json.loads(pathlib.Path(dl.value.path()).read_text(encoding="utf-8"))
        check(fichero.get("app") == "climbenglish", "el archivo dice de que app es: %r" % fichero.get("app"))
        check(fichero.get("schema") == SCHEMA, "el archivo dice la version de formato: %r" % fichero.get("schema"))
        check(fichero.get("progress", {}).get("settings", {}).get("name") == "Alumna", "el archivo lleva el progreso")
        check(dl.value.suggested_filename.startswith("climbenglish-"),
              "nombre de archivo: %s" % dl.value.suggested_filename)

        with tempfile.TemporaryDirectory() as tmp:
            ajeno = pathlib.Path(tmp) / "deutschb2-copia.json"
            ajeno.write_text(json.dumps({"app": "deutschb2", "schema": 1, "progress": {"v": 1, "items": {}}}),
                             encoding="utf-8")
            page.set_input_files("#import", str(ajeno))
            page.wait_for_selector("#confirm .note")
            msg = page.inner_text("#confirm")
            check("deutschb2" in msg and "otra app" in msg, "rechaza el archivo de Deutsch_B2: %s" % msg.strip()[:70])
            vivo = page.evaluate("() => JSON.parse(localStorage.getItem('climbenglish:progress')).settings.name")
            check(vivo == "Alumna", "y no ha tocado el progreso")

            propio = pathlib.Path(tmp) / "copia.json"
            propio.write_text(json.dumps(fichero), encoding="utf-8")
            page.set_input_files("#import", str(propio))
            page.wait_for_selector("#yes")
            check(True, "acepta su propio archivo y pide confirmacion")

        print("\nEmpezar de cero")
        page.goto(url + "#settings")
        page.wait_for_selector("#reset")
        page.click("#reset")
        page.wait_for_selector("#reset-yes")
        page.click("#reset-yes")
        page.wait_for_selector("#who", timeout=20000)
        check(True, "tras borrar vuelve la bienvenida")
        tras = page.evaluate("() => JSON.parse(localStorage.getItem('climbenglish:progress'))")
        check(tras["settings"]["name"] == "" and not tras["words"], "el progreso ha quedado vacio")
        check(OTRA_CLAVE in claves(page), "borrar el progreso no toca los datos de la otra app")

        print("\nSin conexion")
        entrar(page, url)
        ctx.set_offline(True)
        page.goto(url)
        page.wait_for_selector(".play-big", timeout=25000)
        check(True, "la app abre sin conexion")
        # Jugar sin conexion prueba que tambien estan cacheados los JSON de data/.
        page.goto(url + "#play")
        page.wait_for_selector(".wcard .en", timeout=25000)
        check(bool(page.inner_text(".wcard .en").strip()), "y se puede jugar: el contenido sale de la copia local")
        ctx.set_offline(False)

        print("")
        print("Actualizacion automatica")
        entrar(page, url)
        page.goto(url + "#play")
        page.wait_for_selector(".wcard", timeout=25000)
        page.evaluate("() => { window.__marca = 1; }")
        antes = page.evaluate("async () => (await caches.keys()).filter(k => k.startsWith('climbenglish-'))")

        Handler.publicaciones += 1   # a partir de aqui el servidor sirve una VERSION mayor
        page.evaluate("async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); }")
        page.wait_for_timeout(5000)
        check(page.evaluate("() => window.__marca") == 1, "una version nueva no recarga mientras esta jugando")
        check(page.evaluate("() => location.hash") == "#play", "sigue en el juego, sin interrumpir")

        page.evaluate("() => { location.hash = '#home'; }")
        page.wait_for_function("() => window.__marca === undefined", timeout=30000)
        page.wait_for_selector(".play-big", timeout=25000)
        despues = page.evaluate("async () => (await caches.keys()).filter(k => k.startsWith('climbenglish-'))")
        check(despues != antes, "al salir del juego se aplica sola: %s -> %s" % (antes, despues))
        check(len(despues) == 1, "y deja una sola cache propia: %s" % despues)
        check(OTRA_CACHE in caches_de(page), "la cache de la otra app sigue intacta tras actualizar")
        activo = page.evaluate("async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r.active; }")
        check(activo, "queda un service worker activo tras la actualizacion")

        print("")
        prueba_tandas(navegador, url)
        prueba_gym(navegador, url)
        prueba_lagartija(navegador, url)

        print("Dias sin conexion y una semana sin abrir")
        Handler.publicaciones += 1      # se publica algo mientras la tablet esta apagada
        ctx.set_offline(True)
        page.goto(url)
        page.wait_for_selector(".play-big", timeout=25000)
        propias = page.evaluate("async () => (await caches.keys()).filter(k => k.startsWith('climbenglish-'))")
        check(len(propias) == 1, "sin conexion abre con su version de siempre, sin quedarse a medias: %s" % propias)
        page.goto(url + "#words")
        page.wait_for_selector(".mywords, .empty", timeout=20000)
        check(True, "y se puede usar con normalidad")

        ctx.set_offline(False)          # vuelve el wifi dias despues
        page.goto(url)
        page.wait_for_selector(".play-big", timeout=25000)
        page.wait_for_timeout(4000)
        page.goto(url)
        page.wait_for_selector(".play-big", timeout=25000)
        page.wait_for_timeout(3000)
        final = page.evaluate("async () => (await caches.keys()).filter(k => k.startsWith('climbenglish-'))")
        check(final != propias, "al volver la conexion se pone al dia sola: %s -> %s" % (propias, final))
        check(len(final) == 1, "y queda una sola version, nunca dos a medias: %s" % final)
        vivo = page.evaluate("() => !!document.querySelector('.play-big')")
        check(vivo, "la app sigue entera despues de todo el proceso")

        reales = [e for e in errores if "favicon" not in e.lower() and not de_red(e)]
        check(not reales, "sin errores de JavaScript (%d): %s" % (len(reales), reales[:3]))
        navegador.close()

    wd.cancel()
    srv.shutdown()
    print()
    if fallos:
        print("%d FALLOS:" % len(fallos))
        for f in fallos:
            print("  - " + f)
    else:
        print("Todo correcto.")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
