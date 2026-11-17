"""Prueba tools/check_version.py y el hook de pre-commit en un repositorio temporal.

No toca el repositorio de verdad: crea uno nuevo en una carpeta temporal, con una copia
de data/, tools/ y .githooks/, y simula publicaciones moviendo origin/main.

Uso:  python tools/test_check_version.py
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from check_version import check  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")
fallos = []


def ok(cond, msg):
    print(("  OK    " if cond else "  FALLO ") + msg)
    if not cond:
        fallos.append(msg)


SW = """// service worker de prueba
const PREFIX = 'climbenglish-';
const VERSION = %d;
const CACHE = PREFIX + 'v' + VERSION;
const ASSETS = [
  './', 'index.html', 'js/app.js', 'data/ui-strings.json', 'assets/icon-192.png'
];
self.addEventListener('fetch', e => {});
"""


def main():
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="climbenglish-hook-"))
    try:
        def git(*a, check_rc=True):
            r = subprocess.run(["git", "-C", str(tmp), *a], capture_output=True, text=True,
                               encoding="utf-8", errors="replace")
            if check_rc and r.returncode:
                raise RuntimeError(r.stderr)
            return r

        def write(path, text, binary=False):
            f = tmp / path
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(text) if binary else f.write_text(text, encoding="utf-8", newline="\n")

        def commit(msg):
            git("add", "-A")
            return git("commit", "-q", "-m", msg, check_rc=False)

        def publicar():      # simula git push: origin/main pasa a ser HEAD
            git("update-ref", "refs/remotes/origin/main", "HEAD")

        git("init", "-q", "-b", "main")
        git("config", "user.email", "prueba@example.invalid")
        git("config", "user.name", "Prueba")
        git("config", "core.autocrlf", "false")
        write("sw.js", SW % 2)
        write("index.html", "<!doctype html>\n<title>Climb English</title>\n")
        write("js/app.js", "// app\n")
        write("README.md", "Documentacion\n")
        write("assets/icon-192.png", b"\x89PNG0", binary=True)
        shutil.copytree(ROOT / "data", tmp / "data")
        shutil.copytree(ROOT / "tools", tmp / "tools", ignore=shutil.ignore_patterns("__pycache__"))
        shutil.copytree(ROOT / ".githooks", tmp / ".githooks")
        commit("primera version")

        print("check_version")
        ok(check(tmp)[0], "sin origin/main se salta la comprobacion")
        publicar()
        ok(check(tmp)[0], "sin cambios: correcto")

        write("README.md", "Documentacion cambiada\n")
        ok(check(tmp)[0], "cambiar un archivo que NO se sirve no obliga a subir VERSION")

        write("index.html", "<!doctype html>\n<title>Otro</title>\n")
        bien, msg = check(tmp)
        ok(not bien and "index.html" in msg, "cambiar un archivo servido sin subir VERSION: bloquea")

        write("sw.js", SW % 3)
        ok(check(tmp)[0], "al subir VERSION: correcto")

        commit("segunda version")
        publicar()
        write("sw.js", SW % 4)
        ok(check(tmp)[0], "cambiar solo la linea de VERSION no se considera un cambio servido")
        write("sw.js", SW % 3)

        # Los bloques de data/blocks/ no estan en ASSETS: el service worker los guarda
        # leyendo data/blocks.json. Tienen que contar igual.
        bloque = next((tmp / "data" / "blocks").glob("*.json"))
        texto = bloque.read_text(encoding="utf-8")
        bloque.write_text(texto.replace("jelóu", "jeloo", 1), encoding="utf-8", newline="\n")
        bien, msg = check(tmp)
        ok(not bien and "data/blocks/" in msg, "cambiar una grafia en data/blocks/ tambien obliga a subir VERSION")

        print("\nhook de pre-commit")
        git("config", "core.hooksPath", ".githooks")
        r = commit("cambio de grafia sin subir version")
        ok(r.returncode != 0, "el hook bloquea el commit")
        ok("VERSION" in (r.stdout + r.stderr), "y explica que hay que subir VERSION")

        write("sw.js", SW % 4)
        r = commit("cambio de grafia con la version subida")
        ok(r.returncode == 0, "con VERSION subida, el commit pasa")

        print("\n--staged (lo que mira el hook)")
        publicar()
        write("index.html", "<!doctype html>\n<title>Sin marcar</title>\n")
        ok(check(tmp, staged=True)[0], "un cambio sin marcar (git add) no bloquea el commit")
        git("add", "index.html")
        ok(not check(tmp, staged=True)[0], "una vez marcado, si bloquea")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

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
