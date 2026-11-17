"""Lista las palabras que siguen en inglés después de traducir, con cantidad y un ejemplo.

Uso: python3 scripts/i18n/auditar.py [--todas]
"""
import collections
import json
import os
import sys

import traducir

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
data = json.load(open(os.path.join(ROOT, "data", "lindsay", "lindsay_catalogo.json"), encoding="utf-8"))
cats = [json.loads(l)["title"] for l in open(os.path.join(ROOT, "data", "lindsay", "raw_cats.ndjson"), encoding="utf-8")]

count, example = collections.Counter(), {}
for name in [p["nombre"] for p in data["productos"]]:
    traducir.UNKNOWN.clear()
    traducir.translate(name)
    for w in traducir.UNKNOWN:
        count[w] += 1
        example.setdefault(w, name)
for name in set(cats):
    if name in traducir.CATEGORIAS:
        continue
    traducir.UNKNOWN.clear()
    traducir.translate_title(name)
    for w in traducir.UNKNOWN:
        count[w] += 1
        example.setdefault(w, "[cat] " + name)

print(f"palabras sin traducir: {len(count)} distintas, {sum(count.values())} apariciones")
limit = None if "--todas" in sys.argv else 60
for w, c in count.most_common(limit):
    print(f"{c:5}  {w:22} {example[w][:90]}")
