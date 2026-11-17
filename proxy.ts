import { NextResponse, type NextRequest } from 'next/server';

const LOCALES = ['es', 'en'];

// Sin idioma en la ruta: se usa el elegido antes (cookie) o el del navegador; por defecto, español.
function pickLocale(req: NextRequest) {
  const saved = req.cookies.get('lang')?.value;
  if (saved && LOCALES.includes(saved)) return saved;
  const accept = req.headers.get('accept-language') ?? '';
  const first = accept.split(',')[0]?.trim().slice(0, 2).toLowerCase();
  return first === 'en' ? 'en' : 'es';
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;
  const url = req.nextUrl.clone();
  url.pathname = `/${pickLocale(req)}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Todo salvo internos de Next, la API y archivos con extensión (imágenes, favicon…).
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
