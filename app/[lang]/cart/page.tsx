import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CartView } from '@/components/cart-view';
import { Crumbs } from '@/components/ui';
import { getDict, hasLocale } from '@/lib/i18n';

export async function generateMetadata({ params }: PageProps<'/[lang]/cart'>): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDict(lang).cart.title, robots: { index: false } };
}

export default async function CartPage({ params }: PageProps<'/[lang]/cart'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <div className="page">
      <Crumbs lang={lang} items={[{ label: getDict(lang).cart.crumb }]} />
      <CartView lang={lang} />
    </div>
  );
}
