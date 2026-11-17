"""Genera data/tienda/catalog.json (lo lee la tienda Next.js) a partir de la extracción de Lindsay Pro.

Uso (desde la raíz del repo):
    python3 scripts/build_catalog.py

Entradas en data/lindsay/:
    lindsay_catalogo.json  productos, composición y categoría de cada producto
    raw_cats.ndjson        cada categoría con su título y subcategorías
    raw_tiles.ndjson       mosaicos de subcategorías (orden e imagen) de cada página padre
    imagenes.tsv           ruta de imagen de Lindsay → archivo local en public/img/l/<id>.webp (y .s.webp)

Salida: data/tienda/catalog.json, en formato compacto:
    cats:  [[padre, nombre, nombre_es, imagen, [hijos], [partes]], ...]  (el índice es el id)
    prods: {parte: [nombre, nombre_es, imagen, unidad, peso_lb, estado, [[pieza, cantidad, ref], ...]]}
    imagen: id del archivo local, o "" si no hay foto
Los nombres en español salen de scripts/i18n (glosario + traductor); "" si no se pudo traducir.
"""
import json
import os
import re
import sys
from collections import OrderedDict, defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "i18n"))
from traducir import translate, translate_title  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "lindsay")
OUT = os.path.join(ROOT, "data", "tienda", "catalog.json")
IMG_PREFIX = "https://lindsaypro.com/SupplyImages/"
NOT_FOUND = "LindsayImageNotFound"

# Orden del menú principal de Lindsay Pro.
TOP_ORDER = [
    "early-order-promoted-items-20002181",
    "aftermarket-parts-20000224",
    "storm-damage-parts-20001200",
    "wholegoods-20002163",
    "sprinklers-end-guns-booster-pumps-20002165",
    "conversion-10001660",
    "tubing-20001321",
    "fieldnet-10004580",
    "pessl-20001302",
    "flowmeters-20001317",
    "vri-10011300",
]
STATUS = {
    "Comprable": 0,
    "Call for pricing (sin carrito)": 1,
    "No comprable": 2,
    "Sin página propia": 3,
}


def ndjson(name):
    path = os.path.join(SRC, name)
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


LOCAL = {}
with open(os.path.join(SRC, "imagenes.tsv"), encoding="utf-8") as _f:
    for _line in _f:
        _path, _id = _line.rstrip("\n").split("\t")
        LOCAL[_path] = _id


def img(url):
    if not url or NOT_FOUND in url:
        return ""
    path = url[len(IMG_PREFIX):] if url.startswith(IMG_PREFIX) else url
    return LOCAL.get(path, "")


def weight_lb(text):
    m = re.match(r"\s*([\d.,]+)\s*(lbs?)?", text or "", re.I)
    if not m:
        return None
    v = float(m.group(1).replace(",", ""))
    return None if v <= 0 or v >= 99999 else round(v, 2)


def canon(url):
    """Algunos enlaces del sitio repiten la ruta (".../category/a/category/a/b"); se quedan con la última."""
    if url.count("/category/") > 1:
        return "https://lindsaypro.com/category/" + url.rsplit("/category/", 1)[1]
    return url


def main():
    data = json.load(open(os.path.join(SRC, "lindsay_catalogo.json"), encoding="utf-8"))
    raw_cats = {}
    for c in ndjson("raw_cats.ndjson"):
        url = canon(c["url"])
        if url not in raw_cats or not raw_cats[url].get("title"):
            raw_cats[url] = {**c, "url": url}
    tiles = {}
    for t in ndjson("raw_tiles.ndjson"):
        tiles[canon(t["url"])] = [{**x, "url": canon(x["url"])} for x in t.get("tiles", [])]
    for row in data["categorias"]:
        row["url"] = canon(row["url"])

    def parent_of(url):
        p = url.rsplit("/", 1)[0]
        return p if p in raw_cats else None

    children = defaultdict(list)
    for url in raw_cats:
        children[parent_of(url)].append(url)

    tile_img = {}
    for parent, ts in tiles.items():
        for t in ts:
            tile_img.setdefault(t["url"], img(t["img"]))

    def ordered_children(url):
        kids = set(children.get(url, []))
        page = tiles.get(url if url else "https://lindsaypro.com/", [])
        order = [t["url"] for t in page if t["url"] in kids]
        rest = sorted(kids - set(order), key=lambda u: raw_cats[u]["title"].lower())
        return list(OrderedDict.fromkeys(order + rest))

    items = defaultdict(list)
    for row in data["categorias"]:
        if row["part"] not in items[row["url"]]:
            items[row["url"]].append(row["part"])

    # Recorrido en profundidad: el índice de cada categoría es su id.
    tops = sorted(
        children[None],
        key=lambda u: TOP_ORDER.index(u.rsplit("/", 1)[1]) if u.rsplit("/", 1)[1] in TOP_ORDER else 99,
    )
    cats, index = [], {}

    def visit(url, parent_id):
        cid = len(cats)
        index[url] = cid
        c = raw_cats[url]
        name = c["title"].strip()
        es = translate_title(name)
        cats.append([parent_id, name, es if es != name else "", tile_img.get(url, ""), [], items.get(url, [])])
        for kid in ordered_children(url):
            cats[cid][4].append(visit(kid, cid))
        return cid

    roots = [visit(u, -1) for u in tops]

    bom = defaultdict(list)
    for r in data["composicion"]:
        bom[r["padre"]].append([r["pieza"], r["cantidad"], int(r["ref"]) if str(r["ref"]).isdigit() else r["ref"]])

    prods = {}
    for p in data["productos"]:
        name = p["nombre"].strip()
        es = translate(name)
        prods[p["part"]] = [
            name,
            es if es != name else "",
            img(p["imagen"]),
            p["unidad"],
            weight_lb(p["peso"]),
            STATUS.get(p["compra"], 0),
            bom.get(p["part"], []),
        ]

    # Categorías sin productos ni subcategorías con productos no aportan nada.
    missing_parts = {i for c in cats for i in c[5] if i not in prods}
    for c in cats:
        c[5] = [i for i in c[5] if i in prods]

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    out = {"roots": roots, "cats": cats, "prods": prods}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    print(f"categorías: {len(cats)} (raíces {len(roots)})")
    print(f"productos: {len(prods)} · conjuntos: {sum(1 for p in prods.values() if p[6])}")
    print(f"con foto: {sum(1 for p in prods.values() if p[2])} · traducidos: {sum(1 for p in prods.values() if p[1])}")
    print(f"categorías con imagen: {sum(1 for c in cats if c[3])} · traducidas: {sum(1 for c in cats if c[2])}")
    print(f"partes de categoría sin ficha: {len(missing_parts)}")
    print(f"tamaño: {os.path.getsize(OUT) / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
