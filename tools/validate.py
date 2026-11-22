"""Comprueba el contenido de data/ despues de editarlo a mano.

Uso (desde la carpeta del proyecto):   python tools/validate.py

No cambia ningun archivo: solo avisa de lo que haya que arreglar.
"""
import json
import re
import unicodedata
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


FONETICOS = set("æɑɒɔəɛɜɤɨɪɵ"
                "ʃʊʌʒʔʤʧθðŋɲ"
                "ɹɾːˈˌ͡")


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
    # Regla de las 3k: la frase nº k DEL CAMINO de un bloque solo puede usar palabras
    # que esten entre las primeras 3k de ese bloque (o de bloques anteriores). Asi
    # siempre hay una frase lista en cuanto entra una tanda de 3 palabras nuevas.
    # Las frases marcadas "extra": true son de practica y no entran en el camino.
    for b in index["blocks"]:
        data = load(DATA / "blocks" / b["file"])
        if not data:
            continue
        orden = {w.get("id"): i + 1 for i, w in enumerate(data.get("words", []))}
        k = 0
        for s_ in data.get("sentences", []):
            if s_.get("extra"):
                continue
            k += 1
            tope = 3 * k
            tarde = [wid for wid in s_.get("words", [])
                     if orden.get(wid, 0) > tope]
            if tarde:
                # Los 20 bloques estan revisados: esto es un error y ya no puede romperse.
                errors.append(
                    '%s: la frase %d del camino "%s" usa %s, que esta(n) despues de la palabra %d '
                    "del bloque (regla de las 3k)" % (b["file"], k, s_.get("en", "?"), ", ".join(tarde), tope))

    # Toda palabra que aparezca en el TEXTO de una frase tiene que ser una palabra del banco
    # de ese bloque o de uno anterior. No basta con mirar la lista "words": la frase
    # "My name is Alumna" declaraba tres palabras y colaba "is", que es del bloque 3.
    # Se aceptan el plural y la -s de he/she (windows, plays) si la base ya se conoce.
    conocidas = {}
    for w in words:
        conocidas.setdefault(str(w.get("en", "")).lower(), w.get("block", 99))
    varias = sorted([w for w in conocidas if " " in w or "-" in w], key=len, reverse=True)

    def disponible(tok, hasta):
        for cand in (tok, re.sub(r"'s$", "", tok), re.sub(r"s$", "", tok), re.sub(r"es$", "", tok),
                     re.sub(r"ies$", "y", tok), re.sub(r"'t$", "", tok), tok.replace("'", "")):
            if conocidas.get(cand, 99) <= hasta:
                return True
        return False

    for b, s_ in sentences:
        texto = s_.get("en", "")
        for m in varias:                       # primero las entradas de varias palabras
            if conocidas[m] <= b["n"]:
                texto = re.sub(re.escape(m), " ", texto, flags=re.I)
        fuera = [t for t in re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", texto.replace("{name}", " "))
                 if not disponible(t.lower(), b["n"])]
        if fuera:
            errors.append('%s: la frase "%s" usa %s, que la alumna todavia no conoce'
                            % (b["file"], s_.get("en", "?"), ", ".join(sorted(set(fuera)))))

    # La grafia de una palabra dentro de una frase tiene que ser la MISMA que en su ficha.
    # Se colaron 55 frases con la grafia vieja (vocales dobles: "aa" por are, "beeds" por
    # berds) despues de quitarlas de las fichas. Alumna lee las dos pantallas: no pueden discrepar.
    def sin_tildes(t):
        return "".join(c for c in unicodedata.normalize("NFD", t.lower())
                       if not unicodedata.combining(c))

    ficha = {w.get("id"): w for w in words}
    for b, s_ in sentences:
        pron = s_.get("pron", "")
        if re.search(r"(aa|ee|ii|oo|uu)", sin_tildes(pron)):
            errors.append('%s: la frase "%s" tiene una vocal doble en «%s»; las fichas no usan ninguna'
                          % (b["file"], s_.get("en", "?"), pron))
        trozos = re.findall(r"[^\s,.!?¡¿]+", pron.lower())
        for wid in s_.get("words", []):
            w = ficha.get(wid) or {}
            en, pw = str(w.get("en", "")), str(w.get("pron", "")).lower()
            if " " in en or "-" in en or not pw:
                continue
            if pw not in trozos and not any(t.startswith(pw) for t in trozos):
                errors.append('%s: la frase "%s" escribe %s de otra forma que su ficha («%s»): %s'
                              % (b["file"], s_.get("en", "?"), en, pw, pron))

    grammar = load(DATA / "grammar.json") or []

    # Nunca alfabeto fonetico: la grafia se escribe con letras españolas y punto. Una sola
    # excepcion rompe la norma, y Alumna puede acabar escribiendo el simbolo en el juego de
    # escribir o creyendo que es una letra del ingles. Se explica con palabras o no se explica.
    def textos_de_contenido():
        for w in words:
            for campo in ("en", "es", "pron", "say"):
                yield str(w.get(campo) or ""), "palabra %s (%s)" % (w.get("id"), campo)
        for b, s_ in sentences:
            for campo in ("en", "es", "pron"):
                yield str(s_.get(campo) or ""), "%s, frase %s (%s)" % (b["file"], s_.get("id"), campo)
        for g_ in grammar:
            yield str(g_.get("idea") or ""), "grammar.json (%s: idea)" % g_.get("id")
            for t in (g_.get("title") or {}).values():
                yield str(t or ""), "grammar.json (%s: title)" % g_.get("id")
            for e in g_.get("scenes") or []:
                for campo in ("en", "es", "pron"):
                    yield str(e.get(campo) or ""), "grammar.json (%s: scenes.%s)" % (g_.get("id"), campo)
            for q in g_.get("play") or []:
                for campo in ("q", "en", "es", "answer"):
                    yield str(q.get(campo) or ""), "grammar.json (%s: play.%s)" % (g_.get("id"), campo)
                for o in q.get("options") or []:
                    yield str(o or ""), "grammar.json (%s: play.options)" % g_.get("id")

    for texto, donde in textos_de_contenido():
        colados = sorted({c for c in texto if c in FONETICOS})
        if colados:
            errors.append("%s: usa simbolos del alfabeto fonetico (%s); explicalo con palabras"
                          % (donde, ", ".join("U+%04X" % ord(c) for c in colados)))
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
        if g.get("kind", "regla") not in ("regla", "truco"):
            errors.append(f'grammar.json ({g.get("id")}): kind debe ser "regla" o "truco"')
        for q in g.get("play", []):
            # Un juego es o un hueco en una frase ("en" con ___) o una pregunta suelta ("q").
            etiqueta = q.get("en") or q.get("q") or "?"
            if not q.get("q") and "___" not in q.get("en", ""):
                errors.append(f'grammar.json ({g.get("id")}): a "{etiqueta}" le falta el hueco ___ (o un campo "q")')
            if q.get("answer") not in q.get("options", []):
                errors.append(f'grammar.json ({g.get("id")}): la respuesta de "{etiqueta}" no esta entre las opciones')

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
