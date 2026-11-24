import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PivotViewer } from '@/components/pivot-viewer';
import { catHref, Crumbs, Listing, NotFoundBox } from '@/components/ui';
import { catName, categoriesOfZone, partsOfZone, trail } from '@/lib/catalog';
import { fmt, getDict, hasLocale } from '@/lib/i18n';
import { isZone, ZONE_LABEL } from '@/lib/zones';
import { withSettings } from '@/lib/settings';

// Repuestos de una parte del pivot (se llega tocando el visor 3D).
export async function generateMetadata({ params }: PageProps<'/[lang]/z/[zone]'>): Promise<Metadata> {
  const { lang, zone } = await params;
  if (!hasLocale(lang) || !isZone(zone)) return {};
  return { title: ZONE_LABEL[lang][zone] };
}

export default async function ZonePage({ params, searchParams }: PageProps<'/[lang]/z/[zone]'>) {
  await withSettings();
  const { lang, zone } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  if (!isZone(zone)) return <NotFoundBox lang={lang} msg={t.zone.missing} />;
  const sp = await searchParams;
  const name = ZONE_LABEL[lang][zone];
  const parts = partsOfZone(zone);
  const cats = categoriesOfZone(zone);

  return (
    <div className="page">
      <Crumbs lang={lang} items={[{ label: t.zone.crumb }, { label: name }]} />
      <div className="head-row">
        <header className="page-head">
          <span className="eyebrow">{t.zone.eyebrow}</span>
          <h1>{name}</h1>
          <p className="muted">
            {fmt(lang, parts.length)} {t.common.product(parts.length)}
          </p>
          {cats.length > 0 && (
            <ul className="zone-cats">
              {cats.map((c) => (
                <li key={c.id}>
                  <Link href={catHref(lang, c.id)} title={trail(c.id).map((x) => catName(x, lang)).join(' › ')}>
                    {catName(c, lang)}
                    <small>{fmt(lang, c.total)}</small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </header>
        <Suspense>
          <PivotViewer lang={lang} mode="link" active={[zone]} />
        </Suspense>
      </div>
      {parts.length ? (
        <Listing lang={lang} parts={parts} params={sp} base={`/${lang}/z/${zone}`} />
      ) : (
        <div className="empty">
          <p>{t.zone.empty}</p>
        </div>
      )}
    </div>
  );
}
