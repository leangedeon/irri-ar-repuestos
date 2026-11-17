"""Traducción de nombres Lindsay al español con el glosario.

Lindsay escribe los nombres como "SUSTANTIVO,MODIFICADOR,MEDIDA" (ej. "SCREW,3/8-16X4,HX,GR5,ZN").
Cada tramo separado por coma se traduce por separado:
  - las frases conocidas se reemplazan enteras;
  - en inglés el núcleo va al final ("PIVOT ANCHOR"), en español al principio ("anclaje de pivote");
  - los adjetivos concuerdan en género con el núcleo del nombre;
  - medidas, códigos y marcas se dejan como están.
Una palabra que no está en el glosario queda como está y se anota en UNKNOWN (ver auditar.py).
"""
import re

from glosario import KEEP, PHRASES, WORDS

MAX_PHRASE = 4
TOKEN = re.compile(r"[^\s]+")


def is_code(tok):
    t = tok.strip(".-'\"()")
    return not t or bool(re.search(r"[\d/#\"x×]", t)) and not t.isalpha() or bool(re.fullmatch(r"[\d.,/\-x\"']+", t))


INVARIABLE = {"superior", "inferior", "exterior", "interior", "anterior", "posterior", "cualquier", "varios", "otros", "a", "de", "en", "sin", "para", "no", "por"}


def inflect(word, gender, plural=False):
    """Concuerda el adjetivo (su primera palabra) con el género y número del núcleo."""
    parts = word.split(" ")
    w = parts[0]
    if w in INVARIABLE:
        return word
    if gender == "f":
        if w.endswith("o"):
            w = w[:-1] + "a"
        elif w.endswith("or"):
            w = w + "a"
    if plural and not w.endswith("s"):
        w = w + ("s" if w[-1] in "aeiouáéó" else "es")
        w = w.replace("ónes", "ones").replace("ánes", "anes")
    parts[0] = w
    return " ".join(parts)


def is_plural(es):
    first = es.split(" ")[0]
    return first.endswith("s") and first not in ("mes", "gas", "tres")


def lookup(words, i):
    """Busca la frase más larga que empieza en words[i]. Devuelve (largo, (es, tipo)) o None."""
    for n in range(min(MAX_PHRASE, len(words) - i), 0, -1):
        key = " ".join(words[i : i + n]).upper().strip(",;:")
        if key in PHRASES:
            return n, PHRASES[key]
        if key.strip(".") in PHRASES:
            return n, PHRASES[key.strip(".")]
        if n == 1:
            k = key.strip(".")
            if k in WORDS:
                return 1, WORDS[k]
            if key in WORDS:
                return 1, WORDS[key]
    return None


# Palabras que quedaron sin traducir en la última llamada (para la auditoría).
UNKNOWN = []


def split_glued(tok):
    """Separa palabras conocidas pegadas a medidas: "135`SPAN" → ["135`", "SPAN"]."""
    up = tok.strip(".,()").upper()
    if up in WORDS or up in PHRASES or up in KEEP or re.fullmatch(r"[A-Za-z]+(?:[-.'][A-Za-z]+)*\.?", tok):
        return [tok]
    parts = re.findall(r"[A-Za-z]{3,}|[^A-Za-z]+|[A-Za-z]{1,2}", tok)
    if len(parts) < 2:
        return [tok]
    out, buf = [], ""
    for p in parts:
        if p.isalpha() and len(p) >= 3 and (p.upper() in WORDS or p.upper() in PHRASES):
            if buf:
                out.append(buf)
            out.append(p)
            buf = ""
        else:
            buf += p
    if buf:
        out.append(buf)
    return out


def translate_chunk(tokens, head_gender=None, head_plural=False):
    """Traduce una secuencia sin palabras de enlace. Devuelve (texto, género)."""
    tokens = list(tokens)
    items = []  # (tipo, es, original)
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        hit = lookup(tokens, i)
        if hit:
            n, (es, kind) = hit
            if kind != "z":
                items.append((kind, es, " ".join(tokens[i : i + n])))
            i += n
            continue
        bare = tok.strip(".,'\"()[]:;").upper()
        if "." in bare.strip(".") and re.fullmatch(r"[A-Z.\-]+", bare):
            subs = [x for x in bare.split(".") if x]
            if all(x in WORDS or x in KEEP or len(x) <= 1 for x in subs):
                for x in subs:
                    if x in WORDS and WORDS[x][1] != "z":
                        items.append((WORDS[x][1], WORDS[x][0], x))
                    elif x in KEEP:
                        items.append(("c", x, x))
                i += 1
                continue
        if re.fullmatch(r"[A-Z]+(?:[-&][A-Z]+)+", bare):
            subs = [x for x in re.split(r"[-&]", bare) if x]
            if all(x in WORDS or x in KEEP or len(x) <= 1 for x in subs):
                tokens[i : i + 1] = subs
                continue
        if re.fullmatch(r"LDN[A-Z]+", bare):  # códigos de artículo de Senninger
            items.append(("c", tok, tok))
            i += 1
            continue
        if is_code(tok) or bare in KEEP or len(bare) <= 1 or not re.search(r"[A-Za-z]", bare):
            items.append(("c", tok, tok))
        else:
            UNKNOWN.append(bare)
            items.append(("c", tok, tok))
        i += 1
    nouns = [k for k in items if k[0] in ("m", "f")]
    if not nouns:
        # solo adjetivos, marcas o medidas: concuerdan con el núcleo del nombre
        out = []
        for kind, es, orig in items:
            out.append(inflect(es, head_gender, head_plural) if kind in ("a", "b") else es)
        return " ".join(out), head_gender
    head_idx = max(idx for idx, it in enumerate(items) if it[0] in ("m", "f"))
    head = items[head_idx]
    gender = head[0]
    plural = is_plural(head[1])
    before = [it for it in items[:head_idx] if it[0] == "b"]
    words = [inflect(it[1], gender, plural) for it in before] + [head[1]]
    tail_codes = []
    # lo que estaba antes del núcleo, de derecha a izquierda
    for kind, es, orig in reversed(items[:head_idx]):
        if kind == "b":
            continue
        if kind in ("m", "f"):
            words.append(f"de {es}")
        elif kind == "a":
            words.append(inflect(es, gender, plural))
        elif kind == "i":
            words.append(es)
        elif kind in ("k", "c"):
            tail_codes.insert(0, es)
    # lo que estaba después del núcleo
    for kind, es, orig in items[head_idx + 1 :]:
        words.append(inflect(es, gender, plural) if kind in ("a", "b") else es)
    return " ".join(words + tail_codes), gender


LINKS = {"NO": "sin", "FOR": "para", "WITH": "con", "W/": "con", "W": "con", "WO/": "sin", "W/O": "sin", "WO": "sin",
         "WITHOUT": "sin", "LESS": "sin", "AND": "y", "&": "y", "TO": "a", "OR": "o", "OF": "de",
         "PER": "por", "EXCLUDING": "excepto", "ON": "en", "IN": "en", "BY": "por"}


def translate_segment(seg, head_gender=None):
    raw = seg.strip()
    if not raw:
        return raw, head_gender, True
    # "CONDUIT/GLAND": alternativas separadas por barra entre palabras
    alts = re.split(r"(?<=[A-Za-z]{2})/(?=[A-Za-z]{2})", raw)
    if len(alts) > 1:
        res = [translate_segment(a, head_gender) for a in alts]
        return "/".join(r[0] for r in res), res[0][1] or head_gender, True
    if raw.upper() in SIDES:
        return inflect(SIDES[raw.upper()], head_gender), head_gender, True
    whole = PHRASES.get(raw.upper())
    if whole and whole[1] in ("m", "f"):
        return whole[0], whole[1], True
    tokens = [x for t in TOKEN.findall(re.sub(r"(?i)\bw/o\b", " W/O ", re.sub(r"(?i)\bw/(?!o\b)", " W/ ", raw))) for x in split_glued(t)]
    # separa por palabras de enlace
    chunks, links = [[]], []
    for t in tokens:
        if t.startswith("⟪"):
            links.append(t)
            chunks.append([])
        elif t.upper() in LINKS and not (t.upper() in ("ON", "IN", "BY", "OR") and len(tokens) < 3):
            links.append(LINKS[t.upper()])
            chunks.append([])
        else:
            chunks[-1].append(t)
    out, gender = [], head_gender
    for idx, ch in enumerate(chunks):
        if not ch:
            if idx:
                out.append(links[idx - 1])
            continue
        text, g = translate_chunk(ch, gender if idx else head_gender)
        if idx == 0 and g:
            gender = g
        out.append((links[idx - 1] + " " if idx else "") + text)
    return " ".join(out), gender, True


NOTE = re.compile(r"\((Replaces|Replaced by)\s+([^)]*)\)", re.I)

# Frases libres que aparecen en los nombres (notas de Lindsay). Se reemplazan antes de traducir
# por marcadores: "L" = palabra de enlace (separa lo de antes y lo de después), "C" = texto fijo.
PRE = [
    (r"\bRo und\b", "C", "redondo"),
    (r"\bpartially\)", "C", "parcialmente)"),
    (r'"OFF-ON"', "C", '"apagado-encendido"'),
    (r"\bHygr omatic\b", "C", "Hygromatic"),
    (r"\bRei nke\b", "C", "Reinke"),
    (r"\bRein ke\b", "C", "Reinke"),
    (r"\bMechanica\b", "C", "mecánica"),
    (r"\bRounded\b", "C", "redondeado"),
    (r"\bRou nd\b", "C", "redondo"),
    (r"\bSqu are\b", "C", "cuadrado"),
    (r"\bbefore ordering\b", "C", "antes de pedir"),
    (r"\bVendor Item Number\s*:?", "C", "N.º de artículo del proveedor:"),
    (r"\bVendor Item\s*#?:?", "C", "artículo del proveedor"),
    (r"\bP/N#?\s*:?", "C", "N.º de pieza"),
    (r"\bPN#\s*:?", "C", "N.º de pieza"),
    (r"\bAlso used on\b", "L", "también se usa en"),
    (r"\bfor use with\b", "L", "para usar con"),
    (r"\bUse with\b", "L", "usar con"),
    (r"\bused with\b", "L", "usado con"),
    (r"\bSee Notes?\b", "C", "ver notas"),
    (r"\bsee comments\b", "C", "ver comentarios"),
    (r"\bBuyout Item\b", "C", "artículo de compra a terceros"),
    (r"\bCall for Current Pric\w*", "C", "consultar precio vigente"),
    (r"\bCall for pricing\b", "C", "consultar precio"),
    (r"\bOrder minimum quantity of\b", "L", "pedido mínimo de"),
    (r"\bOrder (\d{7}) for repair par\w*", "C", "pedir \\1 para repuestos"),
    (r"\bStocked at\b", "L", "en stock en"),
    (r"\bReplace with\b", "L", "reemplazar por"),
    (r"\bafter inve\w*( is depleted)?", "C", "al agotar stock"),
    (r"\bService Replacement Use\b", "L", "reemplazo de servicio: usar"),
    (r"\bUSA ONLY\b", "C", "solo EE. UU."),
    (r"\bDomestic ONLY\b", "C", "solo mercado de EE. UU."),
    (r"\b(\d+)\s*/\s*bag\b", "C", "\\1 por bolsa"),
    (r"\b(\d+)\s*/\s*box\b", "C", "\\1 por caja"),
    (r"\b(\d+)\s*/\s*BUND\b", "C", "\\1 por atado"),
    (r"\b(\d+)\s*/\s*case\b", "C", "\\1 por caja"),
    (r"\b(\d+)\s*/\s*pk\b", "C", "\\1 por paquete"),
    (r"\b(\d+)\s*ea\b", "C", "\\1 u."),
    (r"\bEA\b", "C", "c/u"),
    (r"(\d+(?:[-/.]\d+)*)\s*-?(?:DEG|DG|DEGREES?)\b\.?", "C", "\\1°"),
    (r"\bWO/T\b", "C", "sin neumático"),
    (r"\bW/O\s*TIRE\b", "C", "sin neumático"),
    (r"\bW/T\b", "C", "con neumático"),
    (r"\bW/O\s*TUBE\b", "C", "sin cámara"),
]
_PRE = [(re.compile(a, re.I), k, b) for a, k, b in PRE]
SLOTS = []  # texto en español protegido durante la traducción


def pre(text):
    text = re.sub(r"(?<=[A-Za-z])&(?=[A-Za-z]{3,})", " & ", text)
    for rx, kind, rep in _PRE:
        def sub(m, kind=kind, rep=rep):
            SLOTS.append(m.expand(rep))
            mark = "⟪" if kind == "L" else "⟨"
            return f" {mark}{len(SLOTS) - 1}{'⟫' if kind == 'L' else '⟩'} "
        text = rx.sub(sub, text)
    return text


def post(text):
    text = re.sub(r"[⟨⟪](\d+)[⟩⟫]", lambda m: SLOTS[int(m.group(1))], text)
    return re.sub(r"\s+", " ", text).replace(" ,", ",").replace("( ", "(").replace(" )", ")").strip()


# Lado: "L" o "R" solos en un tramo.
SIDES = {"L": "izquierdo", "R": "derecho", "LH": "izquierdo", "RH": "derecho", "NO": "NA", "N.O.": "NA", "N.O": "NA"}


def translate(name, title=False):
    """Devuelve el nombre en español, o '' si no se pudo traducir nada."""
    notes = []

    def keep_note(m):
        kind = "Reemplaza a" if m.group(1).lower() == "replaces" else "Reemplazado por"
        rest = m.group(2).replace("partially", "parcialmente")
        notes.append(f"({kind} {rest.strip()})")
        return ""

    SLOTS.clear()
    body = pre(NOTE.sub(keep_note, name)).strip()
    segs = [x for x in re.split(r"(,|\([^)]*\)?)", body) if x and x != ","] if not title else [body]
    out, gender, done, total = [], None, 0, 0
    for s in segs:
        if not s.strip():
            continue
        total += 1
        paren = s.strip().startswith("(")
        inner = s.strip().strip("()") if paren else s
        if paren and "," in inner:
            parts = [translate_segment(x, gender)[0] for x in inner.split(",") if x.strip()]
            text, g, ok = ", ".join(parts), gender, True
        else:
            text, g, ok = translate_segment(inner, gender)
        if paren:
            text = f"({text})"
        if ok:
            done += 1
            if gender is None and g:
                gender = g
        else:
            # un tramo sin traducir: se deja como está, pero el resto puede seguir
            pass
        out.append(text)
    if not done:
        return " ".join(notes) if notes and False else ""
    res = ", ".join(t.strip() for t in out if t.strip())
    res = post(res).replace(", (", " (")
    res = res[:1].upper() + res[1:]
    if notes:
        res = f"{res} {' '.join(notes)}"
    return res


if __name__ == "__main__":
    import sys

    for line in sys.argv[1:]:
        print(f"{line}  →  {translate(line)}")


# Categorías que conviene fijar a mano (nombre exacto de Lindsay → español).
CATEGORIAS = {
    "Early Order - Promoted Items": "Pedido anticipado - Artículos en promoción",
    "Aftermarket Parts": "Repuestos",
    "Storm Damage Parts": "Repuestos por daños de tormenta",
    "WholeGoods": "Equipos completos",
    "Sprinklers, End Guns, & Booster Pumps": "Aspersores, cañones finales y bombas booster",
    "Conversion": "Conversiones",
    "Tubing": "Tubos",
    "Flowmeters": "Caudalímetros",
    "Ancillary": "Equipos auxiliares",
    "Electrical": "Sistema eléctrico",
    "General Parts": "Repuestos generales",
    "Structure": "Estructura",
    "Display Parts": "Repuestos para exhibidor",
    "Skin Packaged Display Parts": "Repuestos en blíster para exhibidor",
    "Parts Boards": "Tableros de repuestos",
    "Complete Boards": "Tableros completos",
    "Poster Only": "Solo póster",
    "Zimmatic Legacy Parts": "Repuestos Zimmatic antiguos",
    "Lateral Move Intakes": "Tomas para equipos de avance frontal",
    "Span Hardware Kits": "Kits de bulonería de tramo",
    "Span Stabilizer Hardware": "Bulonería de estabilizador de tramo",
    "Motor Drop Cable": "Cable de bajada del motor",
    "Sprinkler Package Parts": "Repuestos del paquete de aspersores",
    "Span Truss Options": "Opciones de cercha de tramo",
    "Center and Final Drive": "Motorreductor central y transmisión final",
    "Tower Drains": "Drenajes de torre",
    "Tower Joint Drains": "Drenajes de junta de torre",
    "Corner Center Drive - Inverter Duty": "Motorreductor central de esquina - para inversor",
    "Water Application Package Options": "Opciones de paquete de aplicación de agua",
    "Corner Add-On Ordering Form": "Formulario de pedido de esquina adicional",
    "Tower Control - Soft Start System": "Control de torre - sistema de arranque suave",
    "Purge Valve Package": "Paquete de válvula de purga",
    "Order Control Options": "Opciones de control para pedir",
    "Order Guidance Options": "Opciones de guiado para pedir",
    "System Build Options": "Opciones de armado del equipo",
    "Ditch Fed": "Alimentado por acequia",
    "Hose Fed": "Alimentado por manguera",
    "Pull Winch": "Malacate de tiro",
    "Drop Span End Guns": "Cañones finales para tramo con bajantes",
    "Final Drive, Wheel Gearbox": "Transmisión final, caja reductora de rueda",
    "Sprinklers Whole Good Modules": "Módulos completos de aspersores",
    "Pivot Point Conversion Joint": "Junta de conversión de punto pivote",
    "Span Conversion Joints": "Juntas de conversión de tramo",
    "Tubing by the Foot": "Tubos por pie",
    "Black by the Foot": "Negro por pie",
    "Galv by the Foot": "Galvanizado por pie",
    "Popular Bundles": "Combos más pedidos",
    "Canada Sunset": "Canadá - discontinuados",
    "Pivot Hardware Options": "Opciones de bulonería de pivote",
    "Alternative Antenna Options": "Opciones de antena alternativa",
    "International FieldNet": "FieldNET internacional",
    "Advanced Pump Station Packages": "Paquetes de estación de bombeo avanzada",
    "Advanced Pump Station Options": "Opciones de estación de bombeo avanzada",
    "FieldNET Advanced Pump Station": "Estación de bombeo avanzada FieldNET",
    "Base & Repeater Hardware Options": "Opciones de bulonería para base y repetidor",
    "Air Vent Surge": "Venteo de aire y golpe de ariete",
    "Barb Steel Fittings": "Accesorios de acero con espiga",
    "Black Tubing Fittings": "Accesorios para tubo negro",
    "Disconnects, Pump Panels, Chem Valves, & Generators": "Seccionadores, tableros de bomba, válvulas de químicos y generadores",
    "Snap Track": "Riel a presión",
    "Weld On Fitt": "Accesorios soldables",
    "Skin Packed Items": "Artículos en blíster",
    "Soil Moisture, uMETOS Base": "Humedad de suelo, base uMETOS",
    "Packaged Soil Moisture, uMETOS Base": "Humedad de suelo en paquete, base uMETOS",
    "Soil Probe Installation/Removal Tools": "Herramientas de instalación y extracción de sondas",
    "Replacement Parts": "Repuestos de reemplazo",
    "IM 3000 Installation PKGs'": "Paquetes de instalación IM 3000",
    "Node Power Supply": "Fuente de alimentación del nodo",
    "Electical Components": "Componentes eléctricos",
    "Indicators Lights": "Luces indicadoras",
    "Gear Oil": "Aceite para engranajes",
    "Mobile Pivot/Agri-Tow": "Pivote móvil / Agri-Tow",
    "Black/Hot Rolled Steel": "Acero negro laminado en caliente",
    "Truss Angles/Plates": "Ángulos y placas de cercha",
    "Coupler Halves/Boot Gaskets": "Mitades de acople y juntas de fuelle",
    "Boot Hose/Clamps": "Manguera de fuelle y abrazaderas",
    "Pump to Pivot": "De la bomba al pivote",
    "Wire Alignment-Center Pivot Only": "Alineación por cable - solo pivote central",
    "Wire Alignment (Center Pivot Only)": "Alineación por cable (solo pivote central)",
    "Conversions For Competitive Machines": "Conversiones para equipos de otras marcas",
    "Tower Watch": "Tower Watch",
}

SEP = re.compile(r"(\s+-\s+|,\s*|\s*\(\s*|\s*\)\s*|(?<=[A-Za-z])/(?=[A-Za-z]))")


def translate_title(name):
    """Traduce el nombre de una categoría. Devuelve '' si no se pudo."""
    if name in CATEGORIAS:
        return CATEGORIAS[name]
    SLOTS.clear()
    parts = SEP.split(pre(name))
    out, done = [], 0
    for i, part in enumerate(parts):
        if i % 2:  # separador
            out.append({",": ", "}.get(part.strip(), part) if part.strip() == "," else part)
            continue
        if not part.strip():
            out.append(part)
            continue
        text, _, ok = translate_segment(part)
        if ok:
            done += 1
        out.append(text if ok else part)
    if not done:
        return ""
    res = post("".join(out))
    if res.lower() == name.lower():
        return name
    return res[:1].upper() + res[1:]
