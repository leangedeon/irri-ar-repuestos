'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DICTS, type Locale } from '@/lib/i18n';

// Pedido del cliente, guardado en el navegador.
// Cada línea es una parte con su cantidad. Si es un conjunto, se pide el conjunto completo.
// `from` recuerda de qué conjunto salió una pieza pedida por separado.

export type Line = { part: string; qty: number; from?: string };

const KEY = 'irriar.lindsay.pedido.v1';
const MAX = 9999;
const clamp = (n: number) => Math.max(0, Math.min(MAX, Math.round(Number(n) || 0)));

type Ctx = {
  lang: Locale;
  ready: boolean;
  lines: Line[];
  count: number;
  units: number;
  add: (part: string, qty: number, from?: string) => void;
  addMany: (items: { part: string; qty: number }[], from?: string) => void;
  set: (part: string, qty: number) => void;
  remove: (part: string) => void;
  replace: (part: string, items: { part: string; qty: number }[]) => void;
  clear: () => void;
  toast: (text: string, withLink?: boolean) => void;
};

const CartCtx = createContext<Ctx | null>(null);

function merge(lines: Line[], items: { part: string; qty: number }[], from?: string) {
  const next = lines.map((l) => ({ ...l }));
  for (const { part, qty } of items) {
    const q = clamp(qty);
    if (!q) continue;
    const cur = next.find((l) => l.part === part);
    if (cur) cur.qty = clamp(cur.qty + q);
    else next.push(from ? { part, qty: q, from } : { part, qty: q });
  }
  return next;
}

export function CartProvider({ lang, children }: { lang: Locale; children: ReactNode }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<{ text: string; link: boolean; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const t = DICTS[lang];

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '[]');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee el pedido guardado al montar
      if (Array.isArray(v)) setLines(v.filter((l) => l && typeof l.part === 'string' && l.qty > 0));
    } catch {}
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        try {
          setLines(JSON.parse(e.newValue || '[]'));
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const commit = useCallback((fn: (l: Line[]) => Line[]) => {
    setLines((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const toast = useCallback((text: string, link = false) => {
    setMsg({ text, link, id: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3600);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      ready,
      lines,
      count: lines.length,
      units: lines.reduce((a, l) => a + l.qty, 0),
      add: (part, qty, from) => commit((l) => merge(l, [{ part, qty }], from)),
      addMany: (items, from) => commit((l) => merge(l, items, from)),
      set: (part, qty) =>
        commit((l) => {
          const q = clamp(qty);
          return q ? l.map((x) => (x.part === part ? { ...x, qty: q } : x)) : l.filter((x) => x.part !== part);
        }),
      remove: (part) => commit((l) => l.filter((x) => x.part !== part)),
      replace: (part, items) => commit((l) => merge(l.filter((x) => x.part !== part), items, part)),
      clear: () => commit(() => []),
      toast,
    }),
    [lang, ready, lines, commit, toast]
  );

  return (
    <CartCtx.Provider value={value}>
      {children}
      <div className={`toast${msg ? ' show' : ''}`} role="status" aria-live="polite">
        {msg && (
          <>
            <span>{msg.text}</span>
            {msg.link && <Link href={`/${lang}/cart`}>{t.toast.view}</Link>}
          </>
        )}
      </div>
    </CartCtx.Provider>
  );
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error('useCart fuera de CartProvider');
  return c;
}
