import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import type { Locale } from './i18n';

// Catálogo Lindsay generado por scripts/build_catalog.py (data/tienda/catalog.json).

export const STATUS = { OK: 0, CONSULT: 1, OFF: 2, NOPAGE: 3 } as const;

type RawCat = [parent: number, name: string, nameEs: string, img: string, kids: number[], parts: string[]];
type RawBom = [part: string, qty: number | null, ref: number | string];
type RawProd = [name: string, nameEs: string, img: string, uom: string, lb: number | null, status: number, bom: RawBom[]];

export type Category = {
  id: number;
  parent: number;
  name: string;
  nameEs: string;
  img: string;
  kids: number[];
  parts: string[];
  total: number;
  cover: string;
};

export type BomLine = { part: string; qty: number | null; ref: number | string };

export type Product = {
  part: string;
  name: string;
  nameEs: string;
  img: string;
  uom: string;
  lb: number | null;
  status: number;
  bom: BomLine[];
  replacedBy?: string;
  search: string;
};

type Db = {
  cats: Category[];
  roots: number[];
  prods: Map<string, Product>;
  usedIn: Map<string, string[]>;
  catsOf: Map<string, number[]>;
};

let cache: Db | null = null;

function load(): Db {
  if (cache) return cache;
  const file = path.join(process.cwd(), 'data', 'tienda', 'catalog.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { roots: number[]; cats: RawCat[]; prods: Record<string, RawProd> };

  const prods = new Map<string, Product>();
  for (const [part, [name, nameEs, img, uom, lb, status, bom]] of Object.entries(raw.prods)) {
    prods.set(part, {
      part,
      name,
      nameEs,
      img,
      uom,
      lb,
      status,
      bom: bom.map(([p, qty, ref]) => ({ part: p, qty, ref })),
      search: `${part} ${name} ${nameEs}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
    });
  }
  const usedIn = new Map<string, string[]>();
  for (const p of prods.values()) {
    for (const b of p.bom) {
      const list = usedIn.get(b.part) ?? [];
      if (!list.includes(p.part)) list.push(p.part);
      usedIn.set(b.part, list);
    }
    const m = p.name.match(/\(Replaced by ([0-9A-Z-]+)/i);
    if (m && prods.has(m[1])) p.replacedBy = m[1];
  }

  const cats: Category[] = raw.cats.map(([parent, name, nameEs, img, kids, parts], id) => ({
    id,
    parent,
    name,
    nameEs,
    img,
    kids,
    parts,
    total: 0,
    cover: '',
  }));
  const catsOf = new Map<string, number[]>();
  for (const c of cats)
    for (const part of c.parts) {
      const list = catsOf.get(part) ?? [];
      list.push(c.id);
      catsOf.set(part, list);
    }

  // Productos únicos bajo cada categoría y una imagen de respaldo.
  const all = new Map<number, Set<string>>();
  const count = (c: Category): Set<string> => {
    const done = all.get(c.id);
    if (done) return done;
    const set = new Set(c.parts);
    for (const k of c.kids) for (const p of count(cats[k])) set.add(p);
    all.set(c.id, set);
    c.total = set.size;
    if (!c.img) {
      const kid = c.kids.map((k) => cats[k]).find((k) => k.total && (k.img || k.cover));
      c.cover = kid ? kid.img || kid.cover : ([...set].map((p) => prods.get(p)?.img).find(Boolean) ?? '');
    }
    return set;
  };
  raw.roots.forEach((r) => count(cats[r]));

  cache = { cats, roots: raw.roots, prods, usedIn, catsOf };
  return cache;
}

export const db = () => load();
export const getProduct = (part: string) => load().prods.get(part);
export const getCategory = (id: number) => (Number.isInteger(id) ? load().cats[id] : undefined);
export const roots = () => load().roots.map((id) => load().cats[id]);
export const usedIn = (part: string) => (load().usedIn.get(part) ?? []).map((p) => load().prods.get(p)!).filter(Boolean);
export const catsOf = (part: string) => load().catsOf.get(part) ?? [];

export function trail(id: number): Category[] {
  const out: Category[] = [];
  const { cats } = load();
  for (let c = cats[id]; c; c = cats[c.parent]) out.unshift(c);
  return out;
}

export const isKit = (p?: Product) => !!p && p.bom.length > 0;
export const canOrder = (p?: Product) => !!p && p.status !== STATUS.OFF;
export const catName = (c: Category, lang: Locale) => (lang === 'es' && c.nameEs) || c.name;
export const prodName = (p: Product, lang: Locale) => (lang === 'es' && p.nameEs) || p.name;

export const imgSrc = (id: string, small = false) => (id ? `/img/l/${id}${small ? '.s' : ''}.webp` : '/img/sin-imagen.png');

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function search(q: string): Product[] {
  const terms = fold(q).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const exact = q.trim().toUpperCase();
  const { prods, catsOf: co } = load();
  const out: [number, Product][] = [];
  for (const p of prods.values()) {
    if (terms.every((t) => p.search.includes(t))) {
      const score = p.part === exact ? 0 : p.part.startsWith(exact) ? 1 : co.has(p.part) ? 2 : 3;
      out.push([score, p]);
    }
  }
  out.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name));
  return out.map((x) => x[1]);
}

export function searchCats(q: string, limit = 8): Category[] {
  const terms = fold(q).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return load()
    .cats.filter((c) => c.total && terms.every((t) => fold(`${c.name} ${c.nameEs}`).includes(t)))
    .slice(0, limit);
}

// ---------- datos para el navegador ----------

// Nodo del despiece que se manda al componente interactivo.
export type BomNode = {
  part: string;
  name: string;
  orig: string;
  img: string;
  uom: string;
  lb: number | null;
  status: number;
  replacedBy?: string;
  qty: number | null;
  ref: number | string;
  kids?: BomNode[];
};

export function bomTree(part: string, lang: Locale, seen: string[] = []): BomNode[] {
  const p = getProduct(part);
  if (!p || seen.includes(part)) return [];
  return p.bom
    .map((b) => {
      const c = getProduct(b.part);
      if (!c) return null;
      const node: BomNode = {
        part: c.part,
        name: prodName(c, lang),
        orig: c.name,
        img: c.img,
        uom: c.uom,
        lb: c.lb,
        status: c.status,
        replacedBy: c.replacedBy,
        qty: b.qty,
        ref: b.ref,
      };
      if (c.bom.length) node.kids = bomTree(c.part, lang, [...seen, part]);
      return node;
    })
    .filter((x): x is BomNode => !!x);
}

// Resumen de un producto para el pedido.
export type CartProduct = {
  part: string;
  name: string;
  orig: string;
  img: string;
  uom: string;
  lb: number | null;
  status: number;
  bom: { part: string; name: string; qty: number | null }[];
};

export function cartProduct(part: string, lang: Locale): CartProduct | null {
  const p = getProduct(part);
  if (!p) return null;
  return {
    part: p.part,
    name: prodName(p, lang),
    orig: p.name,
    img: p.img,
    uom: p.uom,
    lb: p.lb,
    status: p.status,
    bom: p.bom.map((b) => ({ part: b.part, name: getProduct(b.part) ? prodName(getProduct(b.part)!, lang) : b.part, qty: b.qty })),
  };
}
