import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BomTable } from '@/components/bom-table';
import { CopyCode, Img, JumpButton } from '@/components/client';
import { Info, Layers } from '@/components/icons';
import { CatCrumbs, catHref, Chips, Crumbs, NotFoundBox, OrderControl, prodHref, ProductRow } from '@/components/ui';
import { Suspense } from 'react';
import { PivotViewer } from '@/components/pivot-viewer';
import { bomTree, catName, catsOf, getCategory, getProduct, imgSrc, isKit, prodName, STATUS, trail, usedIn, zonesOf } from '@/lib/catalog';
import { fmt, getDict, hasLocale, weightLabel } from '@/lib/i18n';
import { withSettings } from '@/lib/settings';

export async function generateMetadata({ params }: PageProps<'/[lang]/p/[part]'>): Promise<Metadata> {
  await withSettings();
  const { lang, part } = await params;
  const p = getProduct(decodeURIComponent(part));
  if (!hasLocale(lang) || !p) return {};
  return { title: `${p.part} · ${prodName(p, lang)}`, description: p.name };
}

export default async function ProductPage({ params, searchParams }: PageProps<'/[lang]/p/[part]'>) {
  await withSettings();
  const { lang, part: rawPart } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  const part = decodeURIComponent(rawPart);
  const p = getProduct(part);
  if (!p) return <NotFoundBox lang={lang} msg={t.product.missing(part)} />;

  const sp = await searchParams;
  const cats = catsOf(part);
  const c = Number(Array.isArray(sp.c) ? sp.c[0] : sp.c);
  const fromCat = Number.isInteger(c) && getCategory(c) ? c : cats[0];
  const used = usedIn(part);
  const kit = isKit(p);
  const name = prodName(p, lang);
  const replacement = p.replacedBy ? getProduct(p.replacedBy) : undefined;

  return (
    <div className="page">
      {fromCat != null ? <CatCrumbs lang={lang} id={fromCat} linkLast /> : <Crumbs lang={lang} items={[]} />}
      <article className="pd">
        <div className="pd-media">
          <Img src={imgSrc(p.img)} alt={name} generic={!p.img} />
        </div>
        <div className="pd-info">
          <div className="pd-chips">
            <Chips p={p} lang={lang} />
          </div>
          <h1>{name}</h1>
          {name !== p.name && (
            <span className="orig">
              {t.common.original}: {p.name}
            </span>
          )}
          <dl className="pd-specs">
            <div>
              <dt>{t.product.code}</dt>
              <dd className="code">
                {p.part}
                <CopyCode code={p.part} lang={lang} />
              </dd>
            </div>
            {p.lb ? (
              <div>
                <dt>{t.product.weight}</dt>
                <dd>
                  {weightLabel(lang, p.lb)} <span className="muted">({fmt(lang, p.lb)} lb)</span>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>{t.product.uom}</dt>
              <dd>{t.uom[p.uom] ?? p.uom}</dd>
            </div>
            <div>
              <dt>{t.product.price}</dt>
              <dd>{p.status === STATUS.CONSULT ? t.product.priceConsult : t.product.priceQuote}</dd>
            </div>
          </dl>
          {p.status === STATUS.OFF ? (
            <div className="note note-off">
              <Info />
              <p>
                {replacement ? (
                  <>
                    {t.product.replacedBy}{' '}
                    <Link href={prodHref(lang, replacement.part)}>
                      <b>{replacement.part}</b> · {prodName(replacement, lang)}
                    </Link>
                    .
                  </>
                ) : (
                  t.product.discontinued
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="pd-buy">
                <OrderControl p={p} lang={lang} label={kit ? t.product.addKit : t.product.addOne} big />
                {kit && (
                  <JumpButton target="despiece">
                    <Layers />
                    {t.product.seePieces(p.bom.length)}
                  </JumpButton>
                )}
              </div>
              {kit && (
                <p className="pd-hint">
                  <Info />
                  <span>{t.product.kitHint}</span>
                </p>
              )}
            </>
          )}
          <Suspense>
            <PivotViewer lang={lang} mode="link" active={zonesOf(p.part)} subject={p.part} />
          </Suspense>
        </div>
      </article>

      {kit && <BomTable lang={lang} root={p.part} tree={bomTree(p.part, lang)} />}

      {used.length > 0 && (
        <section className="block">
          <h2 className="block-title">{t.product.usedIn(used.length)}</h2>
          <ul className="plist">
            {used.map((u) => (
              <ProductRow key={u.part} p={u} lang={lang} />
            ))}
          </ul>
        </section>
      )}

      {cats.length > 0 && (
        <section className="block">
          <h2 className="block-title">{t.product.appearsIn}</h2>
          <ul className="cat-links">
            {cats.map((id) => (
              <li key={id}>
                <Link href={catHref(lang, id)}>
                  {trail(id)
                    .map((x) => catName(x, lang))
                    .join(' › ')}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
