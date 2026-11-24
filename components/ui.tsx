import Form from 'next/form';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  canOrder,
  catName,
  getCategory,
  getProduct,
  imgSrc,
  isKit,
  prodName,
  STATUS,
  trail,
  zonesOf,
  type Category,
  type Product,
} from '@/lib/catalog';
import { fmt, getDict, weightLabel, type Locale } from '@/lib/i18n';
import { isZone, ZONE_LABEL } from '@/lib/zones';
import { AddToCart, Img } from './client';
import { Back, Chev, Close, Grid, Layers, Pin, Rows, Search } from './icons';
import { ParamSelect } from './param-select';

export const catHref = (lang: Locale, id: number) => `/${lang}/c/${id}`;
export const prodHref = (lang: Locale, part: string, from?: number) =>
  `/${lang}/p/${encodeURIComponent(part)}${from != null ? `?c=${from}` : ''}`;

// ---------- migas ----------

export function Crumbs({ lang, items }: { lang: Locale; items: { label: string; href?: string }[] }) {
  const t = getDict(lang);
  return (
    <nav className="crumbs" aria-label="breadcrumb">
      <Link href={`/${lang}`}>{t.common.home}</Link>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'contents' }}>
          <Chev />
          {it.href ? <Link href={it.href}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function CatCrumbs({ lang, id, linkLast = false }: { lang: Locale; id: number; linkLast?: boolean }) {
  const t = trail(id);
  return (
    <Crumbs
      lang={lang}
      items={t.map((c, i) => ({ label: catName(c, lang), href: linkLast || i < t.length - 1 ? catHref(lang, c.id) : undefined }))}
    />
  );
}

// ---------- etiquetas ----------

export function Chips({ p, lang, compact = false }: { p: Product; lang: Locale; compact?: boolean }) {
  const t = getDict(lang).common;
  return (
    <>
      {isKit(p) && (
        <span className="chip chip-kit">
          <Layers />
          {compact ? t.kit : t.kitOf(p.bom.length)}
        </span>
      )}
      {p.status === STATUS.CONSULT && <span className="chip chip-warn">{t.consult}</span>}
      {p.status === STATUS.OFF && <span className="chip chip-off">{p.replacedBy ? t.replaced : t.unavailable}</span>}
    </>
  );
}

export function OrderControl({ p, lang, label, big }: { p: Product; lang: Locale; label?: string; big?: boolean }) {
  const t = getDict(lang).common;
  if (canOrder(p)) return <AddToCart part={p.part} lang={lang} label={label} big={big} />;
  if (p.replacedBy)
    return (
      <Link className="btn btn-outline btn-sm" href={prodHref(lang, p.replacedBy)}>
        {t.seeReplacement(p.replacedBy)}
      </Link>
    );
  return <span className="muted small">{t.cantOrder}</span>;
}

// ---------- mosaicos y productos ----------

export function Tile({ c, lang }: { c: Category; lang: Locale }) {
  const t = getDict(lang).common;
  const id = c.img || c.cover;
  return (
    <Link className="tile" href={catHref(lang, c.id)}>
      <span className="tile-img">
        <Img src={imgSrc(id)} generic={!id} />
      </span>
      <span className="tile-name">{catName(c, lang)}</span>
      <span className="tile-count">
        {fmt(lang, c.total)} {t.product(c.total)}
      </span>
    </Link>
  );
}

function Name({ p, lang, className, href }: { p: Product; lang: Locale; className: string; href: string }) {
  const name = prodName(p, lang);
  return (
    <>
      <Link className={className} href={href}>
        {name}
      </Link>
      {name !== p.name && <span className="orig">{p.name}</span>}
    </>
  );
}

export function ProductRow({ p, lang, from }: { p: Product; lang: Locale; from?: number }) {
  const href = prodHref(lang, p.part, from);
  const uom = getDict(lang).uom;
  return (
    <li className="prow">
      <Link className="thumb" href={href} tabIndex={-1}>
        <Img src={imgSrc(p.img, true)} generic={!p.img} />
      </Link>
      <div className="prow-main">
        <Name p={p} lang={lang} className="prow-name" href={href} />
        <div className="prow-meta">
          <span className="code">{p.part}</span>
          {p.lb ? <span>{weightLabel(lang, p.lb)}</span> : null}
          <span>{uom[p.uom] ?? p.uom}</span>
        </div>
        <div className="chips">
          <Chips p={p} lang={lang} />
        </div>
      </div>
      <div className="prow-add">
        <OrderControl p={p} lang={lang} />
      </div>
    </li>
  );
}

function ProductCard({ p, lang, from }: { p: Product; lang: Locale; from?: number }) {
  const href = prodHref(lang, p.part, from);
  return (
    <li className="pcard">
      <Link className="pcard-img" href={href} tabIndex={-1}>
        <Img src={imgSrc(p.img)} generic={!p.img} />
      </Link>
      <div className="pcard-body">
        <span className="code">{p.part}</span>
        <Link className="pcard-name" href={href}>
          {prodName(p, lang)}
        </Link>
        <div className="chips">
          <Chips p={p} lang={lang} compact />
        </div>
      </div>
      <div className="pcard-add">
        <OrderControl p={p} lang={lang} />
      </div>
    </li>
  );
}

// ---------- listado ----------

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

function pageNumbers(page: number, pages: number): (number | '…')[] {
  const sorted = [...new Set([1, pages, page - 1, page, page + 1].filter((x) => x >= 1 && x <= pages))].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((x, i) => {
    if (i && x - sorted[i - 1] > 1) out.push('…');
    out.push(x);
  });
  return out;
}

export function Listing({ lang, parts, params, base, fromCat }: { lang: Locale; parts: string[]; params: Params; base: string; fromCat?: number }) {
  const t = getDict(lang).list;
  const sort = one(params.orden) || 'catalogo';
  const size = [24, 48, 96].includes(Number(one(params.ver))) ? Number(one(params.ver)) : 24;
  const filter = one(params.filtro).trim();
  const layout = one(params.vista) === 'grilla' ? 'grilla' : 'lista';
  const zona = one(params.zona);
  const zone = isZone(zona) ? zona : null;

  let list = parts.map(getProduct).filter((p): p is Product => !!p);
  if (zone) list = list.filter((p) => zonesOf(p.part).includes(zone));
  if (filter) {
    const terms = filter.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/);
    list = list.filter((p) => terms.every((x) => p.search.includes(x)));
  }
  if (sort === 'nombre') list = [...list].sort((a, b) => prodName(a, lang).localeCompare(prodName(b, lang)));
  if (sort === 'codigo') list = [...list].sort((a, b) => a.part.localeCompare(b.part));
  if (sort === 'conjuntos') list = [...list].sort((a, b) => Number(isKit(b)) - Number(isKit(a)));

  const pages = Math.max(1, Math.ceil(list.length / size));
  const page = Math.min(pages, Math.max(1, Number(one(params.pag)) || 1));
  const slice = list.slice((page - 1) * size, page * size);
  const from = list.length ? (page - 1) * size + 1 : 0;
  const to = Math.min(page * size, list.length);

  const link = (changes: Record<string, string | number | null>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (one(v)) q.set(k, one(v));
    for (const [k, v] of Object.entries(changes)) {
      if (v == null) q.delete(k);
      else q.set(k, String(v));
    }
    const s = q.toString();
    return `${base}${s ? `?${s}` : ''}`;
  };
  const hidden = Object.entries(params).filter(([k, v]) => one(v) && !['filtro', 'pag'].includes(k));

  return (
    <section className="listing" id="listado">
      <div className="list-tools">
        <p
          className="list-count"
          dangerouslySetInnerHTML={{
            __html:
              (list.length ? t.showing(fmt(lang, from), fmt(lang, to), fmt(lang, list.length)) : t.none) +
              (filter ? t.for(filter.replace(/[<>&"]/g, '')) : ''),
          }}
        />
        {zone && (
          <Link className="zone-chip" href={link({ zona: null, pag: null })} scroll={false} aria-label={`${t.zoneClear}: ${ZONE_LABEL[lang][zone]}`}>
            <Pin />
            {ZONE_LABEL[lang][zone]}
            <Close />
          </Link>
        )}
        <Form action={base} className="list-filter" scroll={false}>
          <Search />
          {hidden.map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={one(v)} />
          ))}
          <input name="filtro" type="search" defaultValue={filter} placeholder={t.filter} aria-label={t.filter} />
        </Form>
        <Suspense>
          <label className="sel">
            <span>{t.sort}</span>
            <ParamSelect name="orden" value={sort} options={Object.entries(t.sorts)} />
          </label>
          <label className="sel">
            <span>{t.show}</span>
            <ParamSelect name="ver" value={String(size)} options={[24, 48, 96].map((v) => [String(v), String(v)])} />
          </label>
        </Suspense>
        <div className="seg" role="group" aria-label={t.view}>
          <Link href={link({ vista: 'lista' })} scroll={false} className={layout === 'lista' ? 'on' : ''} aria-label={t.viewList}>
            <Rows />
          </Link>
          <Link href={link({ vista: 'grilla' })} scroll={false} className={layout === 'grilla' ? 'on' : ''} aria-label={t.viewGrid}>
            <Grid />
          </Link>
        </div>
      </div>
      {slice.length ? (
        layout === 'grilla' ? (
          <ul className="pgrid">
            {slice.map((p) => (
              <ProductCard key={p.part} p={p} lang={lang} from={fromCat} />
            ))}
          </ul>
        ) : (
          <ul className="plist">
            {slice.map((p) => (
              <ProductRow key={p.part} p={p} lang={lang} from={fromCat} />
            ))}
          </ul>
        )
      ) : (
        <div className="empty">
          <Search />
          <p>{t.empty}</p>
        </div>
      )}
      {pages > 1 && (
        <nav className="pager" aria-label={t.pages}>
          {page > 1 ? (
            <Link href={link({ pag: page - 1 })} aria-label={t.prev}>
              <Back />
            </Link>
          ) : (
            <span className="off">
              <Back />
            </span>
          )}
          {pageNumbers(page, pages).map((x, i) =>
            x === '…' ? (
              <span key={`g${i}`}>…</span>
            ) : x === page ? (
              <span key={x} className="on" aria-current="page">
                {x}
              </span>
            ) : (
              <Link key={x} href={link({ pag: x })}>
                {x}
              </Link>
            )
          )}
          {page < pages ? (
            <Link href={link({ pag: page + 1 })} aria-label={t.next}>
              <Chev />
            </Link>
          ) : (
            <span className="off">
              <Chev />
            </span>
          )}
        </nav>
      )}
    </section>
  );
}

// ---------- árbol lateral ----------

export function SideTree({ lang, id }: { lang: Locale; id: number }) {
  const path = trail(id);
  const root = path[0];
  const open = new Set(path.map((c) => c.id));
  const branch = (c: Category, depth: number): React.ReactNode => {
    const kids = c.kids.map((k) => getCategory(k)!).filter((k) => k.total);
    const isOpen = open.has(c.id);
    return (
      <li key={c.id} className={`${c.id === id ? 'cur' : ''} ${isOpen ? 'open' : ''}`}>
        <Link href={catHref(lang, c.id)} style={{ '--d': depth } as React.CSSProperties}>
          {catName(c, lang)}
          <small>{fmt(lang, c.total)}</small>
        </Link>
        {isOpen && kids.length > 0 && <ul>{kids.map((k) => branch(k, depth + 1))}</ul>}
      </li>
    );
  };
  return (
    <aside className="side-tree">
      <Link className="side-root" href={catHref(lang, root.id)}>
        {catName(root, lang)}
      </Link>
      <ul>
        {root.kids
          .map((k) => getCategory(k)!)
          .filter((k) => k.total)
          .map((k) => branch(k, 0))}
      </ul>
    </aside>
  );
}

export function NotFoundBox({ lang, msg }: { lang: Locale; msg: string }) {
  const t = getDict(lang).common;
  return (
    <div className="page">
      <div className="empty big">
        <h1>{t.notFound}</h1>
        <p>{msg}</p>
        <Link className="btn btn-primary" href={`/${lang}`}>
          {t.backHome}
        </Link>
      </div>
    </div>
  );
}
