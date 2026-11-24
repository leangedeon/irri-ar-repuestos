import Form from 'next/form';
import { notFound } from 'next/navigation';
import { Search } from '@/components/icons';
import { Suspense } from 'react';
import { PivotViewer } from '@/components/pivot-viewer';
import { Tile } from '@/components/ui';
import { roots, visibleCategories, visibleProducts } from '@/lib/catalog';
import { fmt, getDict, hasLocale } from '@/lib/i18n';
import { withSettings } from '@/lib/settings';

export default async function Home({ params }: PageProps<'/[lang]'>) {
  await withSettings();
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  const prods = visibleProducts();
  const cats = visibleCategories();
  const kits = prods.filter((p) => p.bom.length).length;

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="eyebrow">{t.home.eyebrow}</span>
          <h1>{t.home.title}</h1>
          <p>{t.home.lead}</p>
          <Form action={`/${lang}/search`} className="hero-search" role="search">
            <Search />
            <input name="q" type="search" placeholder={t.header.searchShort} aria-label={t.header.searchBtn} autoComplete="off" enterKeyHint="search" />
            <button className="btn btn-primary" type="submit">
              {t.header.searchBtn}
            </button>
          </Form>
          <dl className="hero-stats">
            <div>
              <dt>{t.home.products}</dt>
              <dd>{fmt(lang, prods.length)}</dd>
            </div>
            <div>
              <dt>{t.home.kits}</dt>
              <dd>{fmt(lang, kits)}</dd>
            </div>
            <div>
              <dt>{t.home.categories}</dt>
              <dd>{fmt(lang, cats.length)}</dd>
            </div>
          </dl>
        </div>
        <Suspense>
          <PivotViewer lang={lang} mode="link" big />
        </Suspense>
      </section>
      <section className="block">
        <h2 className="block-title">{t.home.categories}</h2>
        <div className="tiles">
          {roots().map((c) => (
            <Tile key={c.id} c={c} lang={lang} />
          ))}
        </div>
      </section>
      <section className="block how">
        {t.home.how.map(([h, p], i) => (
          <div key={h}>
            <span className="how-n">{i + 1}</span>
            <h3>{h}</h3>
            <p>{p}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
