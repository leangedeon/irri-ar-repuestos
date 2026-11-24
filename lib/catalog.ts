import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import type { Locale } from './i18n';
import { getSettings, settingsVersion } from './settings';
import { zoneOfCategory, zoneOfName, type Zone } from './zones';

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
  /** Productos únicos visibles (0 si la categoría está oculta en los ajustes). */
  total: number;
  /** Productos únicos sin tener en cuenta los ajustes. */
  size: number;
  cover: string;
  /** Zona del pivot (visor 3D) o null si no tiene vista previa. */
  zone: Zone | null;
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
  /** Productos únicos bajo cada categoría (sin ajustes). */
  under: Set<string>[];
  zonesOf: Map<string, Zone[]>;
};

// ---------- ajustes: categorías visibles ----------

// Se guardan las categorías ocultas por su ruta de nombres originales ("Aftermarket Parts › Electrical"),
// así siguen valiendo aunque se regenere el catálogo y cambien los números.
type View = { hidden: Uint8Array; visible: Set<string> | null; version: number };
let view: View | null = null;

export const catKey = (id: number) =>
  trail(id)
    .map((c) => c.name)
    .join(' › ');

function applySettings(d: Db) {
  const version = settingsVersion();
  if (view && view.version === version) return;
  const off = new Set(getSettings().ocultas);
  const hidden = new Uint8Array(d.cats.length);
  const mark = (c: Category, parentHidden: boolean, prefix: string) => {
    const key = prefix ? `${prefix} › ${c.name}` : c.name;
    const h = parentHidden || off.has(key);
    hidden[c.id] = h ? 1 : 0;
    for (const k of c.kids) mark(d.cats[k], h, key);
  };
  d.roots.forEach((r) => mark(d.cats[r], false, ''));

  let visible: Set<string> | null = null;
  if (off.size) {
    visible = new Set();
    const add = (part: string) => {
      if (visible!.has(part)) return;
      visible!.add(part);
      for (const b of d.prods.get(part)?.bom ?? []) add(b.part);
    };
    for (const c of d.cats) if (!hidden[c.id]) c.parts.forEach(add);
  }

  // Totales y portadas según lo visible.
  const count = (c: Category): Set<string> => {
    if (hidden[c.id]) {
      c.total = 0;
      for (const k of c.kids) count(d.cats[k]);
      return new Set();
    }
    const set = new Set(c.parts);
    for (const k of c.kids) for (const p of count(d.cats[k])) set.add(p);
    c.total = set.size;
    c.cover = '';
    if (!c.img) {
      const kid = c.kids.map((k) => d.cats[k]).find((k) => k.total && (k.img || k.cover));
      c.cover = kid ? kid.img || kid.cover : ([...set].map((p) => d.prods.get(p)?.img).find(Boolean) ?? '');
    }
    return set;
  };
  d.roots.forEach((r) => count(d.cats[r]));
  view = { hidden, visible, version };
}

let cache: Db | null = null;

function load(): Db {
  if (cache) {
    applySettings(cache);
    return cache;
  }
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
    size: 0,
    cover: '',
    zone: null,
  }));
  const catsOf = new Map<string, number[]>();
  for (const c of cats)
    for (const part of c.parts) {
      const list = catsOf.get(part) ?? [];
      list.push(c.id);
      catsOf.set(part, list);
    }

  // Productos únicos bajo cada categoría (sin ajustes).
  const under: Set<string>[] = [];
  const count = (c: Category): Set<string> => {
    if (under[c.id]) return under[c.id];
    const set = new Set(c.parts);
    for (const k of c.kids) for (const p of count(cats[k])) set.add(p);
    under[c.id] = set;
    c.size = set.size;
    return set;
  };
  raw.roots.forEach((r) => count(cats[r]));

  // Zonas del pivot: por categoría (heredando de la madre) y luego por producto.
  const zoneOf = (c: Category, inherited: Zone | null) => {
    const own = zoneOfCategory(c.name);
    c.zone = own === undefined ? inherited : own;
    for (const k of c.kids) zoneOf(cats[k], c.zone);
  };
  raw.roots.forEach((r) => zoneOf(cats[r], null));
  const zonesOf = new Map<string, Zone[]>();
  for (const p of prods.values()) {
    const byName = zoneOfName(p.name);
    const fromCats = [...new Set((catsOf.get(p.part) ?? []).map((id) => cats[id].zone).filter((z): z is Zone => !!z))];
    // El nombre manda cuando la categoría es genérica (bulonería, blísters…) o es más específico que una de varias.
    const list = byName && (!fromCats.length || fromCats.includes(byName)) ? [byName] : fromCats.length ? fromCats : byName ? [byName] : [];
    if (list.length) zonesOf.set(p.part, list);
  }
  // Piezas sin zona propia: toman la del conjunto que las usa.
  for (const p of prods.values()) {
    if (zonesOf.has(p.part)) continue;
    const fromKits = [...new Set((usedIn.get(p.part) ?? []).flatMap((k) => zonesOf.get(k) ?? []))];
    if (fromKits.length && fromKits.length <= 2) zonesOf.set(p.part, fromKits);
  }

  cache = { cats, roots: raw.roots, prods, usedIn, catsOf, under, zonesOf };
  applySettings(cache);
  return cache;
}

export const db = () => load();

const isVisible = (part: string) => {
  load();
  return !view?.visible || view.visible.has(part);
};
const catVisible = (id: number) => {
  load();
  return !view?.hidden[id];
};

/** Producto visible según los ajustes (los ocultos no se muestran en la tienda). */
export const getProduct = (part: string) => {
  const p = load().prods.get(part);
  return p && isVisible(part) ? p : undefined;
};
export const getCategory = (id: number) => (Number.isInteger(id) && catVisible(id) ? load().cats[id] : undefined);
export const roots = () => load().roots.map((id) => load().cats[id]).filter((c) => c.total);
export const usedIn = (part: string) => (load().usedIn.get(part) ?? []).map((p) => getProduct(p)!).filter(Boolean);
export const catsOf = (part: string) => (load().catsOf.get(part) ?? []).filter(catVisible);
export const visibleProducts = () => [...load().prods.values()].filter((p) => isVisible(p.part));
export const visibleCategories = () => load().cats.filter((c) => c.total);

// ---------- zonas del pivot ----------

export const zonesOf = (part: string): Zone[] => load().zonesOf.get(part) ?? [];

/** Zonas de una categoría: la suya o, si es una categoría amplia, las de sus productos más comunes. */
export function zonesOfCategory(id: number): Zone[] {
  const d = load();
  const c = d.cats[id];
  if (!c) return [];
  if (c.zone) return [c.zone];
  const tally = new Map<Zone, number>();
  for (const p of d.under[id]) for (const z of d.zonesOf.get(p) ?? []) tally.set(z, (tally.get(z) ?? 0) + 1);
  const total = d.under[id].size || 1;
  return [...tally.entries()]
    .filter(([, n]) => n / total >= 0.15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([z]) => z);
}

/** Cuántos productos de la lista hay en cada zona. */
export function zoneCounts(parts: string[]): Partial<Record<Zone, number>> {
  const out: Partial<Record<Zone, number>> = {};
  for (const p of parts) for (const z of zonesOf(p)) out[z] = (out[z] ?? 0) + 1;
  return out;
}

/** Categorías visibles con más productos de una zona (para sugerir dónde seguir buscando). */
export function categoriesOfZone(zone: Zone, limit = 8): Category[] {
  const d = load();
  return d.cats
    .filter((c) => c.total && c.parts.length && c.zone === zone)
    .sort((a, b) => b.parts.length - a.parts.length)
    .slice(0, limit);
}

/** Productos visibles de una zona, en orden de catálogo. */
export function partsOfZone(zone: Zone): string[] {
  const d = load();
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (part: string) => {
    if (seen.has(part)) return;
    seen.add(part);
    if ((d.zonesOf.get(part) ?? []).includes(zone) && isVisible(part)) out.push(part);
  };
  // Primero los que están en categorías (más relevantes), después las piezas sueltas de conjuntos.
  for (const c of d.cats) if (!view?.hidden[c.id]) c.parts.forEach(add);
  for (const part of d.zonesOf.keys()) add(part);
  return out;
}

export function trail(id: number): Category[] {
  const out: Category[] = [];
  const { cats } = cache ?? load();
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
    if (terms.every((t) => p.search.includes(t)) && isVisible(p.part)) {
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
