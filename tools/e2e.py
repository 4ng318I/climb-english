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
import re
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "/climb-english/"          # subcarpeta, igual que en GitHub Pages
OTRA_CACHE = "deutschb2-v2"       # caché de otra app del mismo origen
OTRA_CLAVE = "deutschb2:progress"
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

    nueva_version = False

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
        if Handler.nueva_version and limpio.endswith("/sw.js"):
            texto = (ROOT / "sw.js").read_text(encoding="utf-8")
            v = int(re.search(r"const VERSION = (\d+);", texto).group(1))
            texto = texto.replace("const VERSION = %d;" % v, "const VERSION = %d;" % (v + 1))
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


def claves(page):
    return sorted(page.evaluate("() => Object.keys(localStorage)"))


def caches_de(page):
    return sorted(page.evaluate("async () => await caches.keys()"))


def sw_listo(page):
    page.wait_for_function("() => navigator.serviceWorker.controller !== null", timeout=30000)


def entrar(page, url, nombre="Ana"):
    """Pasa la bienvenida (nombre + explicacion del ritmo) hasta el panel."""
    page.goto(url)
    page.wait_for_selector("#who", timeout=20000)
    page.fill("#who", nombre)
    page.click("#start")
    page.wait_for_selector("#go")
    page.click("#go")
    page.wait_for_selector(".play-big", timeout=20000)


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
        ctx = navegador.new_context(accept_downloads=True)
        page = ctx.new_page()
        errores = []
        page.on("pageerror", lambda e: errores.append(str(e)))
        page.on("console", lambda m: errores.append(m.text) if m.type == "error" else None)

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
        page.fill("#who", "Ana")
        page.click("#start")
        page.wait_for_selector("#go")
        page.click("#go")
        page.wait_for_selector(".play-big", timeout=20000)
        nuestras = [k for k in claves(page) if not k.startswith("deutschb2:")]
        check(nuestras == ["climbenglish:progress"], "solo escribe su clave con prefijo: %s" % nuestras)
        guardado = page.evaluate("() => JSON.parse(localStorage.getItem('climbenglish:progress'))")
        check(guardado.get("v") == 1, "el progreso lleva version de esquema v=%s" % guardado.get("v"))
        check(guardado["settings"]["name"] == "Ana", "el nombre se ha guardado")

        print("\nCopia de seguridad")
        page.goto(url + "#settings")
        page.wait_for_selector("#export")
        with page.expect_download() as dl:
            page.click("#export")
        fichero = json.loads(pathlib.Path(dl.value.path()).read_text(encoding="utf-8"))
        check(fichero.get("app") == "climbenglish", "el archivo dice de que app es: %r" % fichero.get("app"))
        check(fichero.get("schema") == 1, "el archivo dice la version de formato: %r" % fichero.get("schema"))
        check(fichero.get("progress", {}).get("settings", {}).get("name") == "Ana", "el archivo lleva el progreso")
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
            check(vivo == "Ana", "y no ha tocado el progreso")

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

        print("\nActualizacion al abrir")
        antes = page.evaluate("async () => (await caches.keys()).filter(k => k.startsWith('climbenglish-'))")
        Handler.nueva_version = True
        page.goto(url)
        page.wait_for_selector(".play-big", timeout=25000)
        page.wait_for_timeout(4000)
        page.goto(url)
        page.wait_for_selector(".play-big", timeout=25000)
        page.wait_for_timeout(3000)
        despues = page.evaluate("async () => (await caches.keys()).filter(k => k.startsWith('climbenglish-'))")
        check(despues != antes, "la version nueva se instala sola al abrir: %s -> %s" % (antes, despues))
        check(len(despues) == 1, "y deja una sola cache propia: %s" % despues)
        check(OTRA_CACHE in caches_de(page), "la cache de la otra app sigue intacta tras actualizar")
        Handler.nueva_version = False

        reales = [e for e in errores if "favicon" not in e.lower()]
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
