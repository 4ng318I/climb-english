"""Comprueba el contenido de data/ despues de editarlo a mano.

Uso (desde la carpeta del proyecto):   python tools/validate.py

No cambia ningun archivo: solo avisa de lo que haya que arreglar.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
POS = {"nombre", "acción", "cualidad", "número", "palabrita", "persona", "saludo", "pregunta", "día"}
errors, warnings = [], []


def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        errors.append(f"{path.name}: no existe")
    except json.JSONDecodeError as e:
        errors.append(f"{path.name}: JSON mal escrito (linea {e.lineno}, columna {e.colno}): {e.msg}")
    return None


def main():
    index = load(DATA / "blocks.json")
    if not index:
        return
    ids, words, sentences = set(), [], []
    for b in index["blocks"]:
        data = load(DATA / "blocks" / b["file"])
        if not data:
            continue
        for w in data.get("words", []):
            where = f'{b["file"]}: palabra "{w.get("en", "?")}"'
            for field in ("id", "en", "es", "pron", "pos", "emoji", "syllables", "stress"):
                if w.get(field) in (None, ""):
                    errors.append(f"{where}: falta «{field}»")
            if w.get("id") in ids:
                errors.append(f"{where}: id repetido «{w.get('id')}»")
            ids.add(w.get("id"))
            if w.get("pos") not in POS:
                warnings.append(f"{where}: categoria desconocida «{w.get('pos')}» (validas: {', '.join(sorted(POS))})")
            if isinstance(w.get("syllables"), int) and isinstance(w.get("stress"), int):
                if not 1 <= w["stress"] <= w["syllables"]:
                    errors.append(f"{where}: «stress» debe estar entre 1 y «syllables»")
            words.append(w)
        for s in data.get("sentences", []):
            where = f'{b["file"]}: frase "{s.get("en", "?")}"'
            for field in ("id", "en", "es", "pron", "emoji"):
                if not s.get(field):
                    errors.append(f"{where}: falta «{field}»")
            if s.get("id") in ids:
                errors.append(f"{where}: id repetido «{s.get('id')}»")
            ids.add(s.get("id"))
            sentences.append((b, s))

    word_block = {w["id"]: w.get("block") for w in words if "id" in w}
    grammar = load(DATA / "grammar.json") or []
    rule_ids = {g.get("id") for g in grammar}
    for b, s in sentences:
        for wid in s.get("words", []):
            if wid not in word_block:
                errors.append(f'{b["file"]}: la frase "{s["en"]}" usa una palabra que no existe: {wid}')
            elif word_block[wid] > b["n"]:
                errors.append(f'{b["file"]}: la frase "{s["en"]}" usa «{wid}», que es de un bloque posterior')
        if s.get("grammar") and s["grammar"] not in rule_ids:
            warnings.append(f'{b["file"]}: la frase "{s["en"]}" apunta a una regla que no existe: {s["grammar"]}')

    for g in grammar:
        for q in g.get("play", []):
            if "___" not in q.get("en", ""):
                errors.append(f'grammar.json ({g.get("id")}): a "{q.get("en")}" le falta el hueco ___')
            if q.get("answer") not in q.get("options", []):
                errors.append(f'grammar.json ({g.get("id")}): la respuesta de "{q.get("en")}" no esta entre las opciones')

    songs = (load(DATA / "songs.json") or {}).get("songs", [])
    for s in songs:
        where = f'songs.json: "{s.get("title", "?")}"'
        if not re.match(r"^https://", s.get("youtube", "")):
            errors.append(f"{where}: «youtube» debe ser un enlace https://")
        n = len(s.get("words", []))
        if not 5 <= n <= 8:
            warnings.append(f"{where}: tiene {n} palabras (lo ideal es de 5 a 8)")
        for w in s.get("words", []):
            if not all(w.get(k) for k in ("en", "es", "pron")):
                errors.append(f'{where}: a la palabra "{w.get("en", "?")}" le falta en, es o pron')
            if len(str(w.get("en", "")).split()) > 2:
                errors.append(f'{where}: "{w.get("en")}" parece un trozo de letra; pon solo palabras sueltas')

    ui = load(DATA / "ui-strings.json") or {}
    for key, v in ui.items():
        if key.startswith("_"):
            continue
        if not isinstance(v, dict) or not v.get("es") or "from" not in v:
            errors.append(f"ui-strings.json: «{key}» necesita «es» y «from»")
    used = set()
    for js in (ROOT / "js").rglob("*.js"):
        # Solo claves literales: si tras la comilla viene un "+", la clave se arma al vuelo.
        used |= set(re.findall(r"""\b[tT]\(\s*['"]([a-z0-9_]+)['"]\s*[,)]""", js.read_text(encoding="utf-8")))
        used |= set(re.findall(r"""(?:howto|empty)\([^)]*?['"]([a-z][a-z0-9_]+)['"]\s*[,)]""", js.read_text(encoding="utf-8")))
    for key in sorted(used - set(ui)):
        warnings.append(f"ui-strings.json: el codigo usa el texto «{key}» y no esta en el archivo")

    for name in ("silly.json", "medals.json"):
        load(DATA / name)

    print(f"Bloques: {len(index['blocks'])} | Palabras: {len(words)} | Frases: {len(sentences)} | "
          f"Reglas: {len(grammar)} | Canciones: {len(songs)}")
    if len(words) < 300:
        warnings.append("Hay menos de 300 palabras")
    if len(sentences) < 100:
        warnings.append("Hay menos de 100 frases")


main()
for w in warnings:
    print("AVISO:", w)
for e in errors:
    print("ERROR:", e)
print("Todo correcto." if not errors and not warnings else f"{len(errors)} errores, {len(warnings)} avisos.")
sys.exit(1 if errors else 0)
