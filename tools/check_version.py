"""Exige subir VERSION en sw.js en cuanto cambia un archivo que se sirve a la tablet.

Por que: la tablet guarda la app entera para funcionar sin conexion. Si se publica un
archivo nuevo sin subir VERSION, el service worker no se entera de que hay que volver a
guardarlo todo y la tablet puede quedarse con una mezcla de version vieja y nueva.

La comparacion es contra lo ultimo publicado: origin/main, que es lo que sirve GitHub
Pages. Varios commits para una misma publicacion necesitan, por tanto, UNA sola subida.

Se considera servido:
  - todo lo que esta en la lista ASSETS de sw.js,
  - los archivos de bloques que data/blocks.json enumera (el service worker los guarda
    leyendo ese indice, asi que no aparecen en ASSETS),
  - el propio sw.js. Un cambio que solo toque la linea de VERSION no cuenta como cambio.

Uso:
  python tools/check_version.py            # carpeta de trabajo contra origin/main
  python tools/check_version.py --staged   # lo que esta en el index (hook de pre-commit)
  Opciones: --repo RUTA, --base REF (por defecto origin/main)
Termina con codigo 1 si hay que subir la version.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys

VERSION_RE = re.compile(r"^const VERSION = (\d+);\s*$", re.M)
ASSETS_RE = re.compile(r"const ASSETS = \[(.*?)\];", re.S)


def git(repo, *args, ok_fail=False):
    r = subprocess.run(["git", "-C", str(repo), *args], capture_output=True)
    if r.returncode and not ok_fail:
        raise RuntimeError("git %s: %s" % (" ".join(args), r.stderr.decode(errors="replace").strip()))
    return r.stdout if r.returncode == 0 else None


def norm(b):
    """Mismo contenido con finales de linea de Windows o de Unix."""
    return b.replace(b"\r\n", b"\n") if b is not None else None


def version_of(texto):
    m = VERSION_RE.search(texto)
    return int(m.group(1)) if m else 0


def assets_of(texto):
    m = ASSETS_RE.search(texto)
    return set(re.findall(r"'([^']+)'", m.group(1))) if m else set()


def blocks_of(datos):
    """Archivos de data/blocks/ que enumera el indice de bloques."""
    try:
        idx = json.loads(datos.decode("utf-8"))
        return {"data/blocks/" + b["file"] for b in idx.get("blocks", [])}
    except Exception:
        return set()


def served(path):
    return "index.html" if path == "./" else path


def check(repo=None, staged=False, base="origin/main"):
    """Devuelve (ok, mensaje)."""
    repo = pathlib.Path(repo or pathlib.Path(__file__).resolve().parent.parent)
    if git(repo, "rev-parse", "--verify", "--quiet", base, ok_fail=True) is None:
        return True, "Aviso: no existe %s, se salta la comprobacion de version." % base

    def ahora(path):
        if staged:
            return norm(git(repo, "show", ":%s" % path, ok_fail=True))
        f = repo / path
        return norm(f.read_bytes()) if f.exists() else None

    def antes(path):
        return norm(git(repo, "show", "%s:%s" % (base, path), ok_fail=True))

    sw_ahora = (ahora("sw.js") or b"").decode("utf-8", "replace")
    sw_antes = (antes("sw.js") or b"").decode("utf-8", "replace")
    v_ahora, v_antes = version_of(sw_ahora), version_of(sw_antes)

    archivos = {served(p) for p in assets_of(sw_ahora) | assets_of(sw_antes)}
    archivos |= blocks_of(ahora("data/blocks.json") or b"")
    archivos |= blocks_of(antes("data/blocks.json") or b"")

    cambiados = [p for p in sorted(archivos) if ahora(p) != antes(p)]
    if VERSION_RE.sub("", sw_ahora) != VERSION_RE.sub("", sw_antes):
        cambiados.append("sw.js")

    if not cambiados:
        return True, "Ningun archivo servido ha cambiado (VERSION %d)." % v_ahora
    if v_ahora > v_antes:
        return True, "%d archivo(s) servido(s) cambiado(s), VERSION %d -> %d: correcto." % (
            len(cambiados), v_antes, v_ahora)
    lista = "\n".join("  - " + p for p in cambiados[:20]) + ("\n  ..." if len(cambiados) > 20 else "")
    return False, (
        "Hay archivos servidos que han cambiado respecto a %s, pero VERSION en sw.js sigue\n"
        "en %d (publicado: %d).\n%s\n"
        "-> Pon en sw.js \"const VERSION = %d;\"%s" % (
            base, v_ahora, v_antes, lista, v_antes + 1,
            " y marca el archivo con \"git add sw.js\"." if staged else "."))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--staged", action="store_true")
    ap.add_argument("--repo")
    ap.add_argument("--base", default="origin/main")
    a = ap.parse_args()
    ok, msg = check(a.repo, a.staged, a.base)
    print(("" if ok else "ERROR: ") + msg)
    sys.exit(0 if ok else 1)
