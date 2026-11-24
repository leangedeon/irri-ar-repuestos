import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CatCrumbs, catHref, Listing, NotFoundBox, SideTree, Tile } from '@/components/ui';
import { Suspense } from 'react';
import { PivotViewer } from '@/components/pivot-viewer';
import { catName, getCategory, zoneCounts, zonesOfCategory } from '@/lib/catalog';
import { isZone } from '@/lib/zones';
import { fmt, getDict, hasLocale } from '@/lib/i18n';
import { withSettings } from '@/lib/settings';

export async function generateMetadata({ params }: PageProps<'/[lang]/c/[id]'>): Promise<Metadata> {
  await withSettings();
  const { lang, id } = await params;
  const c = getCategory(Number(id));
  if (!hasLocale(lang) || !c) return {};
  return { title: catName(c, lang) };
}

export default async function CategoryPage({ params, searchParams }: PageProps<'/[lang]/c/[id]'>) {
  await withSettings();
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  const c = getCategory(Number(id));
  if (!c) return <NotFoundBox lang={lang} msg={t.category.missing} />;
  const kids = c.kids.map((k) => getCategory(k)!).filter((k) => k.total);
  const sp = await searchParams;
  const name = catName(c, lang);
  const zona = Array.isArray(sp.zona) ? sp.zona[0] : sp.zona;
  const listed = c.parts.length > 0;

  return (
    <div className="page page-side">
      <SideTree lang={lang} id={c.id} />
      <div className="page-main">
        <CatCrumbs lang={lang} id={c.id} />
        <div className="head-row">
          <header className="page-head">
            <h1>{name}</h1>
            <p className="muted">
              {fmt(lang, c.total)} {t.common.product(c.total)}
              {kids.length ? ` · ${fmt(lang, kids.length)} ${t.common.subcategory(kids.length)}` : ''}
              {name !== c.name && <span className="orig">{c.name}</span>}
            </p>
          </header>
          <Suspense>
            <PivotViewer
              lang={lang}
              mode={listed ? 'filter' : 'link'}
              active={zonesOfCategory(c.id)}
              counts={listed ? zoneCounts(c.parts) : undefined}
              selected={listed && zona && isZone(zona) ? zona : null}
              subject={name}
            />
          </Suspense>
        </div>
        {kids.length > 0 && (
          <section className="block">
            <h2 className="block-title">{c.parts.length ? t.category.subcats : t.category.pick}</h2>
            <div className="tiles">
              {kids.map((k) => (
                <Tile key={k.id} c={k} lang={lang} />
              ))}
            </div>
          </section>
        )}
        {c.parts.length > 0 && (
          <section className="block">
            {kids.length > 0 && <h2 className="block-title">{t.category.productsOf(name)}</h2>}
            <Listing lang={lang} parts={c.parts} params={sp} base={catHref(lang, c.id)} fromCat={c.id} />
          </section>
        )}
      </div>
    </div>
  );
}
