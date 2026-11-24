import { NextResponse, type NextRequest } from 'next/server';
import { cartProduct } from '@/lib/catalog';
import { hasLocale } from '@/lib/i18n';
import { refreshSettings } from '@/lib/settings';

// Datos de los productos del pedido (el pedido vive en el navegador).
// GET /api/products?lang=es&parts=0112326,1836194
export async function GET(req: NextRequest) {
  await refreshSettings();
  const lang = req.nextUrl.searchParams.get('lang') ?? 'es';
  const parts = (req.nextUrl.searchParams.get('parts') ?? '').split(',').filter(Boolean).slice(0, 500);
  const locale = hasLocale(lang) ? lang : 'es';
  const out = Object.fromEntries(parts.map((p) => [p, cartProduct(p, locale)]).filter(([, v]) => v));
  return NextResponse.json(out);
}
