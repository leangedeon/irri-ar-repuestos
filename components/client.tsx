'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DICTS, LOCALES, type Locale } from '@/lib/i18n';
import { useCart } from './cart-context';
import { Cart, Copy as CopyIcon, Menu } from './icons';

export function CartBadge({ lang }: { lang: Locale }) {
  const { count } = useCart();
  return (
    <Link className="hd-cart" href={`/${lang}/cart`} aria-label={DICTS[lang].header.cart}>
      <Cart />
      <span>{DICTS[lang].header.cart}</span>
      {count > 0 && <em>{count}</em>}
    </Link>
  );
}

// Selector de idioma: misma página en el otro idioma.
export function LangSwitch({ lang }: { lang: Locale }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const rest = pathname.replace(/^\/(es|en)(?=\/|$)/, '');
  const qs = params.toString();
  const t = DICTS[lang].lang;
  return (
    <nav className="lang" aria-label={t.label}>
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={`/${l}${rest}${qs ? `?${qs}` : ''}`}
          hrefLang={l}
          lang={l}
          aria-current={l === lang ? 'true' : undefined}
          title={DICTS[l].lang[l]}
          onClick={() => {
            document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
          }}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}

export function LangSwitchFallback({ lang }: { lang: Locale }) {
  return (
    <nav className="lang" aria-label={DICTS[lang].lang.label}>
      {LOCALES.map((l) => (
        <a key={l} href={`/${l}`} aria-current={l === lang ? 'true' : undefined}>
          {l.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}

export function MenuToggle({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      className="hd-menu"
      aria-label={label}
      aria-expanded={open}
      onClick={() => {
        const on = !open;
        setOpen(on);
        document.body.classList.toggle('menu-open', on);
      }}
    >
      <Menu />
    </button>
  );
}

export function NavLinksPlain({ items }: { items: { id: number; href: string; label: string }[] }) {
  return (
    <>
      {items.map((it) => (
        <Link key={it.href} href={it.href}>
          {it.label}
        </Link>
      ))}
    </>
  );
}

// Menú principal: resalta la categoría raíz de la página actual y cierra el menú del celular al navegar.
// `owner[id]` es la categoría raíz de cada categoría.
export function NavLinks({ items, owner }: { items: { id: number; href: string; label: string }[]; owner?: number[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const m = pathname.match(/\/c\/(\d+)/);
  const cat = m ? Number(m[1]) : /\/p\//.test(pathname) && params.get('c') ? Number(params.get('c')) : -1;
  const current = owner && cat >= 0 ? owner[cat] : -1;
  return (
    <>
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={it.id === current ? 'on' : ''} onClick={() => document.body.classList.remove('menu-open')}>
          {it.label}
        </Link>
      ))}
    </>
  );
}

export function AddToCart({
  part,
  lang,
  label,
  big = false,
}: {
  part: string;
  lang: Locale;
  label?: string;
  big?: boolean;
}) {
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const t = DICTS[lang];
  return (
    <div className="add">
      <input
        className="qty"
        type="number"
        inputMode="numeric"
        min={1}
        max={9999}
        value={qty}
        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
        aria-label={t.common.qtyOf(part)}
      />
      <button
        className={`btn btn-primary ${big ? '' : 'btn-sm'}`}
        onClick={() => {
          cart.add(part, qty);
          cart.toast(t.toast.added(qty, part), true);
        }}
      >
        <Cart />
        <span>{label ?? t.common.add}</span>
      </button>
    </div>
  );
}

export function CopyCode({ code, lang }: { code: string; lang: Locale }) {
  const { toast } = useCart();
  const t = DICTS[lang].product;
  return (
    <button
      className="copy"
      aria-label={t.copy}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          toast(t.copied(code));
        } catch {}
      }}
    >
      <CopyIcon />
    </button>
  );
}

export function JumpButton({ target, children }: { target: string; children: React.ReactNode }) {
  return (
    <button className="btn btn-ghost" onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
      {children}
    </button>
  );
}

// Imagen con respaldo genérico si el archivo no carga.
export function Img({ src, alt = '', generic }: { src: string; alt?: string; generic: boolean }) {
  const [failed, setFailed] = useState(false);
  const off = generic || failed;
  return (
    <img
      src={failed ? '/img/sin-imagen.png' : src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={off ? 'is-generic' : undefined}
      onError={() => setFailed(true)}
    />
  );
}
