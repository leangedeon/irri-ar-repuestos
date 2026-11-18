import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Form from 'next/form';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { CartProvider } from '@/components/cart-context';
import { CartBadge, LangSwitch, LangSwitchFallback, MenuToggle, NavLinks, NavLinksPlain } from '@/components/client';
import { Search } from '@/components/icons';
import { catName, db, roots, trail } from '@/lib/catalog';
import { getDict, hasLocale, LOCALES } from '@/lib/i18n';
import '../globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-geist-mono' });

// Etiquetas cortas para el menú en español (los nombres completos se ven en cada página).
const NAV_ES: Record<string, string> = {
  'Early Order - Promoted Items': 'Pedido anticipado',
  'Storm Damage Parts': 'Daños por tormenta',
  'Sprinklers, End Guns, & Booster Pumps': 'Aspersores y cañones',
};

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDict(lang);
  return {
    title: { default: t.meta.title, template: `%s · IRRI-AR` },
    description: t.meta.description,
    icons: { icon: '/brand/favicon.png' },
    alternates: { languages: { es: '/es', en: '/en' } },
  };
}

export default async function LangLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  const nav = roots().map((c) => ({ id: c.id, href: `/${lang}/c/${c.id}`, label: (lang === 'es' && NAV_ES[c.name]) || catName(c, lang) }));
  const { cats } = db();
  const owner = cats.map((c) => trail(c.id)[0].id);

  return (
    <html lang={lang} className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <CartProvider lang={lang}>
          <header className="hd">
            <div className="hd-in">
              <MenuToggle label={t.header.menu} />
              <Link className="hd-logo" href={`/${lang}`} aria-label={t.header.home}>
                <img src="/brand/logo-irri-ar.jpg" alt="IRRI-AR · Lindsay" width={150} height={51} />
              </Link>
              <Form action={`/${lang}/search`} className="hd-search" role="search">
                <Search />
                <input name="q" type="search" placeholder={t.header.search} aria-label={t.header.searchBtn} autoComplete="off" enterKeyHint="search" />
                <button type="submit">{t.header.searchBtn}</button>
              </Form>
              <div className="hd-right">
                <Suspense fallback={<LangSwitchFallback lang={lang} />}>
                  <LangSwitch lang={lang} />
                </Suspense>
                <CartBadge lang={lang} />
              </div>
            </div>
            <nav className="nav" aria-label={t.header.menu}>
              <div className="nav-in">
                <Suspense fallback={<NavLinksPlain items={nav} />}>
                  <NavLinks items={nav} owner={owner} />
                </Suspense>
              </div>
            </nav>
          </header>
          <main id="view">{children}</main>
          <footer className="ft">
            <div className="ft-in">
              <img src="/brand/logo-irri-ar.jpg" alt="IRRI-AR" width={120} height={41} />
              <p>{t.footer}</p>
            </div>
          </footer>
        </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}
