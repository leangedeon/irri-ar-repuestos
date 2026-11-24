'use client';

import { useMemo, useState, useTransition } from 'react';
import { DICTS, fmt, type Locale } from '@/lib/i18n';
import type { SaveResult } from '@/app/[lang]/ajustes/actions';
import { Chev, Search } from './icons';
import { useCart } from './cart-context';

export type SettingsNode = { key: string; name: string; orig: string; size: number; own: number; kids: number[] };

type Props = {
  lang: Locale;
  nodes: SettingsNode[];
  roots: number[];
  hidden: string[];
  save: (ocultas: string[]) => Promise<SaveResult>;
};

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function SettingsTree({ lang, nodes, roots, hidden, save }: Props) {
  const t = DICTS[lang].settings;
  const { toast } = useCart();
  const parent = useMemo(() => {
    const p = new Int32Array(nodes.length).fill(-1);
    nodes.forEach((n, i) => n.kids.forEach((k) => (p[k] = i)));
    return p;
  }, [nodes]);

  const initial = useMemo(() => {
    const off = new Set(hidden);
    const on = new Uint8Array(nodes.length);
    const walk = (i: number, parentOn: boolean) => {
      on[i] = parentOn && !off.has(nodes[i].key) ? 1 : 0;
      nodes[i].kids.forEach((k) => walk(k, !!on[i]));
    };
    roots.forEach((r) => walk(r, true));
    return on;
  }, [nodes, roots, hidden]);

  const [on, setOn] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const [q, setQ] = useState('');
  const [pending, start] = useTransition();
  const [failure, setFailure] = useState('');

  // Estado de cada nodo para la casilla: todo visible, parcial o nada.
  const mixed = useMemo(() => {
    const m = new Uint8Array(nodes.length);
    const walk = (i: number): [boolean, boolean] => {
      let anyOn = !!on[i];
      let anyOff = !on[i];
      for (const k of nodes[i].kids) {
        const [a, b] = walk(k);
        anyOn ||= a;
        anyOff ||= b;
      }
      m[i] = anyOn && anyOff ? 1 : 0;
      return [anyOn, anyOff];
    };
    roots.forEach(walk);
    return m;
  }, [on, nodes, roots]);

  const toggle = (i: number) => {
    const next = on.slice();
    const value = mixed[i] ? 1 : on[i] ? 0 : 1;
    const down = (j: number) => {
      next[j] = value;
      nodes[j].kids.forEach(down);
    };
    down(i);
    if (value) for (let p = parent[i]; p >= 0; p = parent[p]) next[p] = 1;
    setOn(next);
  };
  const setAll = (value: 0 | 1) => setOn(new Uint8Array(nodes.length).fill(value));

  // Lista mínima: la categoría oculta más alta de cada rama.
  const hiddenKeys = (state: Uint8Array) => {
    const out: string[] = [];
    const walk = (i: number) => {
      if (!state[i]) out.push(nodes[i].key);
      else nodes[i].kids.forEach(walk);
    };
    roots.forEach(walk);
    return out;
  };

  const changes = useMemo(() => on.reduce((n, v, i) => n + (v !== saved[i] ? 1 : 0), 0), [on, saved]);
  const visibleCount = useMemo(() => on.reduce((n, v) => n + v, 0), [on]);

  // Búsqueda: muestra las coincidencias con sus categorías madre, todo abierto.
  const match = useMemo(() => {
    const terms = fold(q).trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return null;
    const keep = new Uint8Array(nodes.length);
    nodes.forEach((n, i) => {
      const text = fold(`${n.name} ${n.orig}`);
      if (terms.every((x) => text.includes(x))) for (let p = i; p >= 0 && !keep[p]; p = parent[p]) keep[p] = 1;
    });
    return keep;
  }, [q, nodes, parent]);

  const onSave = () =>
    start(async () => {
      let res: SaveResult;
      try {
        res = await save(hiddenKeys(on));
      } catch (e) {
        res = { ok: false, reason: String((e as Error)?.message ?? e) };
      }
      if (res.ok) {
        setSaved(on);
        setFailure('');
        toast(t.saved);
      } else {
        setFailure(res.reason ?? '');
        toast(t.error);
      }
    });

  const row = (i: number, depth: number): React.ReactNode => {
    if (match && !match[i]) return null;
    const n = nodes[i];
    const isOpen = !!match || open.has(i);
    const hasKids = n.kids.length > 0;
    const state = mixed[i] ? 'mixed' : on[i] ? 'on' : 'off';
    return (
      <li key={i} className={`st-row st-${state} ${on[i] !== saved[i] ? 'st-changed' : ''}`}>
        <div className="st-line" style={{ '--d': depth } as React.CSSProperties}>
          {hasKids ? (
            <button
              className={`st-exp ${isOpen ? 'open' : ''}`}
              aria-expanded={isOpen}
              aria-label={isOpen ? t.collapseOne(n.name) : t.expandOne(n.name)}
              onClick={() =>
                setOpen((s) => {
                  const x = new Set(s);
                  if (x.has(i)) x.delete(i);
                  else x.add(i);
                  return x;
                })
              }
            >
              <Chev />
            </button>
          ) : (
            <span className="st-exp" />
          )}
          <label>
            <input
              type="checkbox"
              checked={!!on[i] && !mixed[i]}
              ref={(el) => {
                if (el) el.indeterminate = !!mixed[i];
              }}
              onChange={() => toggle(i)}
            />
            <span className="st-name">
              {n.name}
              {n.name !== n.orig && <small>{n.orig}</small>}
            </span>
          </label>
          <span className="st-meta">
            {hasKids && <span>{t.subcats(n.kids.length)}</span>}
            <span>
              {fmt(lang, n.size)} {DICTS[lang].common.product(n.size)}
            </span>
          </span>
        </div>
        {hasKids && isOpen && <ul>{n.kids.map((k) => row(k, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <div className="st">
      <div className="st-tools">
        <label className="list-filter st-search">
          <Search />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} aria-label={t.search} />
        </label>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(new Set(nodes.map((_, i) => i).filter((i) => nodes[i].kids.length)))}>
          {t.expandAll}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(new Set())}>
          {t.collapseAll}
        </button>
        <span className="st-sep" />
        <button className="btn btn-ghost btn-sm" onClick={() => setAll(1)}>
          {t.showAll}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setAll(0)}>
          {t.hideAll}
        </button>
      </div>
      <ul className="st-tree">{roots.map((r) => row(r, 0))}</ul>
      <div className={`st-bar ${changes ? 'dirty' : ''}`}>
        <p>
          <b>{t.visible(fmt(lang, visibleCount), fmt(lang, nodes.length))}</b>
          <span>{changes ? t.changes(changes) : t.noChanges}</span>
          {failure && (
            <span className="st-err" role="alert">
              {t.error} {failure}
            </span>
          )}
        </p>
        <button className="btn btn-ghost" disabled={!changes || pending} onClick={() => setOn(saved)}>
          {t.discard}
        </button>
        <button className="btn btn-primary" disabled={!changes || pending} onClick={onSave}>
          {pending ? t.saving : t.save}
        </button>
      </div>
    </div>
  );
}
