"""Comprueba que validate.py SALTA cuando el contenido esta mal.

Un validador que no se prueba al reves no vale: si una comprobacion se rompe,
deja de avisar y nadie se entera, porque todo sigue saliendo "Todo correcto".

Cada prueba estropea el contenido a proposito y mira que salte el error que toca.
TODO se hace sobre una COPIA en una carpeta temporal: este script NUNCA toca
data/ del proyecto. Antes se hacia estropeando el fichero de verdad y
restaurandolo despues, y un fallo a medias dejaba los datos tocados.

Uso:  python tools/test_validate.py
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
fallos = []


def ok(cond, msg):
    print(("  OK    " if cond else "  FALLO ") + msg)
    if not cond:
        fallos.append(msg)


def valida(carpeta):
    """Pasa el validador sobre la copia y devuelve (bien, texto)."""
    entorno = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
    r = subprocess.run([sys.executable, str(carpeta / "tools" / "validate.py")],
                       capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env=entorno)
    return r.returncode == 0, (r.stdout or "") + (r.stderr or "")


def pelado(t):
    """Sin tildes y en minusculas: la salida del subproceso puede perderlas por el camino."""
    t = "".join(c for c in unicodedata.normalize("NFD", str(t))
                if not unicodedata.combining(c))
    return t.lower().replace("�", "?")


def prueba(nombre, retoca, espera):
    """Copia el proyecto, lo estropea con `retoca` y exige que el error mencione `espera`."""
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="climb-val-"))
    try:
        destino = tmp / "proyecto"
        shutil.copytree(ROOT, destino, ignore=shutil.ignore_patterns(
            ".git", "__pycache__", "docs", "node_modules"))
        retoca(destino)
        bien, salida = valida(destino)
        acerto = (not bien) and pelado(espera) in pelado(salida)
        ok(acerto, "%s%s" % (nombre, "" if not bien else "  [NO SALTO]"))
        if not acerto:
            # Impreso sin tildes: la consola de Windows (cp1252) no las sabe escribir.
            print("        esperaba <%s>, salio: %s"
                  % (pelado(espera), pelado(salida).strip()[-220:] or "nada"))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# --- Retoques, cada uno sobre su propia copia ---

def _grammar(destino, cambia):
    f = destino / "data" / "grammar.json"
    g = json.loads(f.read_text(encoding="utf-8"))
    cambia({r["id"]: r for r in g}, g)
    f.write_text(json.dumps(g, ensure_ascii=False, indent=2), encoding="utf-8")


def _bloque(destino, nombre, cambia):
    f = destino / "data" / "blocks" / nombre
    d = json.loads(f.read_text(encoding="utf-8"))
    cambia(d)
    f.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    print("El validador salta cuando el contenido esta mal\n")

    print("Las frases")
    prueba("una frase del camino que usa una palabra de mas adelante (regla de las 3k)",
           lambda d: _bloque(d, "01-hello.json",
                             lambda b: b["sentences"][0].update(words=[b["words"][-1]["id"]])),
           "regla de las 3k")
    prueba("una frase que cuela una palabra que la alumna no conoce",
           lambda d: _bloque(d, "01-hello.json",
                             lambda b: b["sentences"][1].update(en=b["sentences"][1]["en"] + " umbrella")),
           "todavia no conoce")
    prueba("una frase que escribe una palabra distinto que su ficha",
           lambda d: _bloque(d, "03-colours.json",
                             lambda b: b["sentences"][0].update(pron="it is reed")),
           "de otra forma que su ficha")
    prueba("una frase con una vocal doble, que las fichas no usan",
           lambda d: _bloque(d, "03-colours.json",
                             lambda b: b["sentences"][0].update(pron="it is red aa")),
           "vocal doble")

    print("\nLa voz")
    prueba("un juego que le daria a la voz una grafia en vez de la palabra",
           lambda d: _grammar(d, lambda F, g: F["t-water-sorpresa"]["play"][0].update(say="uóte")),
           "no es inglés del banco")
    prueba("un juego que le daria español a la voz",
           lambda d: _grammar(d, lambda F, g: F["t-e-muda"]["play"][0].update(say="No suena")),
           "no es inglés del banco")
    prueba("una pregunta suelta que no dice que tiene que decir la voz",
           lambda d: _grammar(d, lambda F, g: F["t-knee-k"]["play"][0].pop("say")),
           "sin «say»")
    prueba("un ejemplo de ficha que no es ingles y se leeria en alto",
           lambda d: _grammar(d, lambda F, g: F["t-a-de-cat"]["scenes"][0].update(en="la a abierta")),
           "no es inglés del banco")

    print("\nLas opciones de los juegos")
    prueba("una opcion que contesta con coma detras del si o del no",
           lambda d: _grammar(d, lambda F, g: F["t-e-muda"]["play"][0].update(
               answer="No, calla", options=["No, calla", "Sí, suena"])),
           "una coma detrás del sí")
    prueba("dos opciones repetidas en el mismo juego",
           lambda d: _grammar(d, lambda F, g: F["t-knee-k"]["play"][0].update(
               options=["ni", "ni", "ké-ne"])),
           "opciones repetidas")
    prueba("una respuesta que no esta entre las opciones",
           lambda d: _grammar(d, lambda F, g: F["t-knee-k"]["play"][0].update(answer="otra cosa")),
           "no esta entre las opciones")

    print("\nEl alfabeto fonetico")
    prueba("un simbolo fonetico colado en el texto de una ficha",
           lambda d: _grammar(d, lambda F, g: g[0].update(idea=g[0]["idea"] + " suena æ.")),
           "alfabeto fonetico")

    print("\nQue el proyecto de verdad sigue intacto")
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "validate.py")],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    ok(r.returncode == 0, "data/ del proyecto no se ha tocado: %s" % (r.stdout or "").strip().splitlines()[-1:])

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
