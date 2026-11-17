import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CatCrumbs, catHref, Listing, NotFoundBox, SideTree, Tile } from '@/components/ui';
import { catName, getCategory } from '@/lib/catalog';
import { fmt, getDict, hasLocale } from '@/lib/i18n';

export async function generateMetadata({ params }: PageProps<'/[lang]/c/[id]'>): Promise<Metadata> {
  const { lang, id } = await params;
  const c = getCategory(Number(id));
  if (!hasLocale(lang) || !c) return {};
  return { title: catName(c, lang) };
}

export default async function CategoryPage({ params, searchParams }: PageProps<'/[lang]/c/[id]'>) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  const c = getCategory(Number(id));
  if (!c) return <NotFoundBox lang={lang} msg={t.category.missing} />;
  const kids = c.kids.map((k) => getCategory(k)!).filter((k) => k.total);
  const sp = await searchParams;
  const name = catName(c, lang);

  return (
    <div className="page page-side">
      <SideTree lang={lang} id={c.id} />
      <div className="page-main">
        <CatCrumbs lang={lang} id={c.id} />
        <header className="page-head">
          <h1>{name}</h1>
          <p className="muted">
            {fmt(lang, c.total)} {t.common.product(c.total)}
            {kids.length ? ` · ${fmt(lang, kids.length)} ${t.common.subcategory(kids.length)}` : ''}
            {name !== c.name && <span className="orig">{c.name}</span>}
          </p>
        </header>
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
