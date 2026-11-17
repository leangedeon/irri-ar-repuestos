import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Search } from '@/components/icons';
import { catHref, Crumbs, Listing, prodHref } from '@/components/ui';
import { catName, getProduct, search, searchCats, trail } from '@/lib/catalog';
import { fmt, getDict, hasLocale } from '@/lib/i18n';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export async function generateMetadata({ params, searchParams }: PageProps<'/[lang]/search'>): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDict(lang).search.title(one((await searchParams).q)), robots: { index: false } };
}

export default async function SearchPage({ params, searchParams }: PageProps<'/[lang]/search'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  const sp = await searchParams;
  const q = one(sp.q).trim();
  if (!q) redirect(`/${lang}`);

  // Un código exacto va directo a su ficha.
  const exact = getProduct(q.toUpperCase());
  if (exact) redirect(prodHref(lang, exact.part));

  const results = search(q);
  const cats = searchCats(q);

  return (
    <div className="page">
      <Crumbs lang={lang} items={[{ label: t.search.crumb }]} />
      <header className="page-head">
        <h1>{t.search.title(q)}</h1>
        <p className="muted">
          {fmt(lang, results.length)} {t.common.product(results.length)}
        </p>
      </header>
      {cats.length > 0 && (
        <section className="block">
          <h2 className="block-title">{t.search.categories}</h2>
          <ul className="cat-links">
            {cats.map((c) => (
              <li key={c.id}>
                <Link href={catHref(lang, c.id)}>
                  {trail(c.id)
                    .map((x) => catName(x, lang))
                    .join(' › ')}
                  <small>{fmt(lang, c.total)}</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {results.length ? (
        <section className="block">
          <Listing lang={lang} parts={results.map((p) => p.part)} params={sp} base={`/${lang}/search`} />
        </section>
      ) : (
        <div className="empty">
          <Search />
          <p>{t.search.empty}</p>
        </div>
      )}
    </div>
  );
}
