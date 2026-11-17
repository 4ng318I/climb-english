"""Genera las capturas del README con un progreso de demostracion.

No usa datos reales de nadie: inventa un progreso coherente (unas semanas de uso)
a partir del contenido de data/, lo mete en localStorage y fotografia cada pantalla.

Uso (desde la carpeta del proyecto):  python tools/screenshots.py [carpeta]
Por defecto escribe en docs/img/.
Requiere:  pip install playwright  &&  python -m playwright install chromium
"""
import functools
import http.server
import json
import pathlib
import sys
import threading
from datetime import date, timedelta

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SALIDA = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "img"
BASE = "/climb-english/"
TABLET = {"width": 1280, "height": 800}
sys.stdout.reconfigure(encoding="utf-8")


def progreso_demo():
    """Un progreso verosimil: etapa 1 coronada y media etapa 2 en marcha."""
    idx = json.loads((ROOT / "data" / "blocks.json").read_text(encoding="utf-8"))
    hoy = date.today()
    palabras, frases, dias = {}, {}, []
    aprendidas = set()
    n = 0

    for b in idx["blocks"][:3]:                      # bloques 1 a 3
        d = json.loads((ROOT / "data" / "blocks" / b["file"]).read_text(encoding="utf-8"))
        tope = len(d["words"]) if b["n"] <= 2 else 9  # el tercero, a medias
        for w in d["words"][:tope]:
            n += 1
            dia = (hoy - timedelta(days=max(0, 14 - n // 3))).isoformat()
            palabras[w["id"]] = {
                "box": 1 + (n % 5), "learned": dia, "due": (hoy + timedelta(days=2)).isoformat(),
                "last": dia, "ok": 3 + n % 4, "seen": 5 + n % 3,
                "said": 1 if n % 2 else 0, "written": 1 if n % 3 == 0 else 0,
            }
            aprendidas.add(w["id"])
        for s in d["sentences"]:
            if all(i in aprendidas for i in s["words"]):
                frases[s["id"]] = {"box": 2 + len(frases) % 3, "learned": hoy.isoformat(),
                                   "due": (hoy + timedelta(days=3)).isoformat(),
                                   "last": hoy.isoformat(), "ok": 2, "seen": 3}

    for i in range(13, 0, -1):                       # dos semanas de diario; hoy, sin estrenar
        if i in (4, 9):                              # un par de dias sin entrar
            continue
        dias.append({"date": (hoy - timedelta(days=i)).isoformat(),
                     "newWords": 6 if i > 1 else 3, "newSentences": 2 if i % 2 else 1,
                     "wordSessions": 2, "sentenceSessions": 2, "minutes": 9, "grammar": 1 if i % 4 == 0 else 0})

    medallas = {m: (hoy - timedelta(days=7)).isoformat() for m in
                ("first-word", "words-10", "words-25", "words-50", "sentence-1", "sentence-10",
                 "blocks-1", "stage-1", "grammar-1", "said-10", "written-10", "sessions-10")}

    return {
        "v": 1, "created": (hoy - timedelta(days=14)).isoformat(),
        "settings": {"name": "Ana", "dark": True, "mic": False, "voice": "en-GB", "rate": 0.85,
                     "forceVoice": False},
        "words": palabras, "sentences": frases,
        "grammar": {"g-i-am": {"seen": hoy.isoformat(), "plays": 2},
                    "g-it-is": {"seen": hoy.isoformat(), "plays": 1}},
        "songs": {"happy": {"unlocked": 6, "day": (hoy - timedelta(days=1)).isoformat()}},
        "days": dias, "medals": medallas,
        "stats": {"sessions": 18, "silly": 4, "said": 23, "written": 11},
        "ui": {"flipped": {}, "stageSeen": 1, "rot": 2, "lastNew": "words", "blocksSeen": [1, 2]},
        "lastVisit": (hoy - timedelta(days=1)).isoformat(),
        "lastExport": (hoy - timedelta(days=3)).isoformat(),
    }


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def translate_path(self, path):
        path = path.split("?")[0].split("#")[0]
        if path.startswith(BASE):
            path = "/" + path[len(BASE):]
        return super().translate_path(path)


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = "http://127.0.0.1:%d%s" % (srv.server_address[1], BASE)
    demo = json.dumps(progreso_demo())

    with sync_playwright() as pw:
        navegador = pw.chromium.launch()
        ctx = navegador.new_context(viewport=TABLET, device_scale_factor=1)
        ctx.add_init_script("localStorage.setItem('climbenglish:progress', %s);" % json.dumps(demo))
        # Chromium sin voces instaladas mostraria el aviso "falta la voz inglesa", que en
        # una tablet de verdad no sale. Para las fotos se finge una voz britanica.
        ctx.add_init_script("""
          speechSynthesis.getVoices = () => [{ lang: 'en-GB', name: 'Google UK English Female',
            default: true, localService: true, voiceURI: 'uk' }];
          speechSynthesis.speak = () => {};
        """)
        page = ctx.new_page()

        def foto(nombre, hash_="", espera=".stage, .play-big", completa=False, antes=None):
            page.goto(url + hash_)
            page.wait_for_selector(espera, timeout=25000)
            if antes:
                antes(page)
            page.wait_for_timeout(900)
            destino = SALIDA / (nombre + ".png")
            page.screenshot(path=str(destino), full_page=completa)
            print("  " + destino.relative_to(ROOT).as_posix())

        def hasta_el_juego(p):
            """Pasa las palabras nuevas de la sesion hasta llegar al primer minijuego."""
            for _ in range(5):
                if not p.locator(".btn.next").count():
                    break
                p.click(".btn.next")
                p.wait_for_timeout(800)
            p.wait_for_selector(".tile, .drum, .mcard", timeout=20000)

        print("Capturas en %s" % SALIDA.relative_to(ROOT).as_posix())
        foto("panel", "", ".play-big")
        foto("sesion", "#play", ".wcard")
        foto("juego", "#play", ".wcard", antes=hasta_el_juego)
        foto("pronunciacion", "#pron", ".wcard")
        foto("escribir", "#write", ".keyboard")
        foto("gramatica", "#grammar", ".rules")
        foto("cancion", "#song", ".songs")
        foto("palabras", "#words", ".mywords", completa=False)
        foto("progreso", "#progress", ".progress", completa=True)
        foto("mayores", "#settings", ".settings", completa=True)
        navegador.close()

    srv.shutdown()
    print("Listo.")


if __name__ == "__main__":
    main()
