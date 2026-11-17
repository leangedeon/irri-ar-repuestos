'use client';

import Link from 'next/link';
import { Fragment, useState } from 'react';
import { DICTS, fmt, weightLabel, type Locale } from '@/lib/i18n';
import type { BomNode } from '@/lib/catalog';
import { useCart } from './cart-context';
import { Img } from './client';
import { Cart, Chev, Layers, Minus, Plus } from './icons';

const OFF = 2;
const CONSULT = 1;
const imgSrc = (id: string) => (id ? `/img/l/${id}.s.webp` : '/img/sin-imagen.png');

type Row = { key: string; node: BomNode; depth: number; base: number };

// Despiece de un conjunto: cantidades por conjunto, multiplicador y piezas anidadas.
export function BomTable({ lang, root, tree }: { lang: Locale; root: string; tree: BomNode[] }) {
  const t = DICTS[lang];
  const cart = useCart();
  const [mult, setMult] = useState(1);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [edited, setEdited] = useState<Record<string, number>>({});

  // Filas visibles, con la cantidad base acumulada (cantidad por conjunto raíz).
  const rows: Row[] = [];
  const walk = (nodes: BomNode[], depth: number, chain: number, prefix: string) => {
    nodes.forEach((node, i) => {
      const key = `${prefix}${i}`;
      const base = (node.qty ?? 1) * chain;
      rows.push({ key, node, depth, base });
      if (node.kids && open.has(key)) walk(node.kids, depth + 1, base, `${key}.`);
    });
  };
  walk(tree, 0, 1, '');

  const orderable = rows.filter((r) => r.node.status !== OFF);
  const qtyOf = (r: Row) => edited[r.key] ?? r.base * mult;
  const nSel = orderable.filter((r) => checked.has(r.key)).length;
  const allOn = nSel > 0 && nSel === orderable.length;

  const toggle = (key: string, on: boolean) =>
    setChecked((s) => {
      const n = new Set(s);
      if (on) n.add(key);
      else n.delete(key);
      return n;
    });

  const changeMult = (v: number) => {
    setMult(Math.max(1, Math.min(999, Math.round(v) || 1)));
    setEdited({});
  };

  const addSelected = () => {
    const sel = orderable.filter((r) => checked.has(r.key)).map((r) => ({ part: r.node.part, qty: qtyOf(r) }));
    if (!sel.length) return cart.toast(t.product.pickFirst);
    cart.addMany(sel, root);
    cart.toast(t.toast.addedMany(sel.length, sel.reduce((a, s) => a + s.qty, 0)), true);
  };

  return (
    <section className="block bom" id="despiece">
      <div className="bom-head">
        <div>
          <h2 className="block-title">{t.product.bomTitle}</h2>
          <p className="muted">{t.product.bomLead(tree.length)}</p>
        </div>
        <label className="mult">
          <span>{t.product.kitsQty}</span>
          <div className="stepper">
            <button type="button" onClick={() => changeMult(mult - 1)} aria-label={t.product.less}>
              <Minus />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              value={mult}
              onChange={(e) => changeMult(Number(e.target.value))}
              aria-label={t.product.kitsQty}
            />
            <button type="button" onClick={() => changeMult(mult + 1)} aria-label={t.product.more}>
              <Plus />
            </button>
          </div>
        </label>
      </div>
      <div className="table-wrap">
        <table className="bom-table">
          <thead>
            <tr>
              <th className="c-check">
                <input
                  type="checkbox"
                  checked={allOn}
                  ref={(el) => {
                    if (el) el.indeterminate = nSel > 0 && !allOn;
                  }}
                  onChange={(e) => setChecked(e.target.checked ? new Set(orderable.map((r) => r.key)) : new Set())}
                  aria-label={t.product.selectAllAria}
                />
              </th>
              <th className="c-ref">{t.product.cols.ref}</th>
              <th className="c-item">{t.product.cols.item}</th>
              <th className="c-w">{t.product.cols.weight}</th>
              <th className="c-u">{t.product.cols.uom}</th>
              <th className="c-per">{t.product.cols.per}</th>
              <th className="c-qty">{t.product.cols.qty}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const { node } = r;
              const ok = node.status !== OFF;
              const href = `/${lang}/p/${encodeURIComponent(node.part)}`;
              const isOpen = open.has(r.key);
              return (
                <Fragment key={r.key}>
                  <tr className={`bom-row${r.depth ? ' nested' : ''}`} style={{ '--d': r.depth } as React.CSSProperties}>
                    <td className="c-check">
                      {ok && (
                        <input
                          type="checkbox"
                          checked={checked.has(r.key)}
                          onChange={(e) => toggle(r.key, e.target.checked)}
                          aria-label={t.product.select(node.part)}
                        />
                      )}
                    </td>
                    <td className="c-ref">{node.ref ?? ''}</td>
                    <td className="c-item">
                      <div className="bom-item">
                        {node.kids?.length ? (
                          <button
                            className="bom-exp"
                            aria-expanded={isOpen}
                            aria-label={t.product.expand(node.part)}
                            onClick={() =>
                              setOpen((s) => {
                                const n = new Set(s);
                                if (isOpen) n.delete(r.key);
                                else n.add(r.key);
                                return n;
                              })
                            }
                          >
                            <Chev />
                          </button>
                        ) : (
                          <span className="bom-exp-sp" />
                        )}
                        <Link className="thumb" href={href} tabIndex={-1}>
                          <Img src={imgSrc(node.img)} generic={!node.img} />
                        </Link>
                        <div>
                          <Link href={href} className="bom-name">
                            {node.name}
                          </Link>
                          {node.name !== node.orig && <span className="orig">{node.orig}</span>}
                          <div className="bom-meta">
                            <span className="code">{node.part}</span>
                            {node.kids?.length ? (
                              <span className="chip chip-kit">
                                <Layers />
                                {t.common.kit}
                              </span>
                            ) : null}
                            {node.status === CONSULT && <span className="chip chip-warn">{t.common.consult}</span>}
                            {node.status === OFF && <span className="chip chip-off">{node.replacedBy ? t.common.replaced : t.common.unavailable}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="c-w">{weightLabel(lang, node.lb) || '—'}</td>
                    <td className="c-u">{t.uom[node.uom] ?? node.uom}</td>
                    <td className="c-per">{node.qty == null ? <span title={t.product.qtyUnknown}>—</span> : fmt(lang, node.qty)}</td>
                    <td className="c-qty">
                      {ok ? (
                        <div className="add">
                          <input
                            className="qty"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={9999}
                            value={qtyOf(r)}
                            onChange={(e) => {
                              setEdited((s) => ({ ...s, [r.key]: Math.max(1, Number(e.target.value) || 1) }));
                              toggle(r.key, true);
                            }}
                            aria-label={t.common.qtyOf(node.part)}
                          />
                          <button
                            className="btn btn-icon"
                            aria-label={t.common.addOf(node.part)}
                            onClick={() => {
                              cart.add(node.part, qtyOf(r), root);
                              cart.toast(t.toast.added(qtyOf(r), node.part), true);
                            }}
                          >
                            <Cart />
                          </button>
                        </div>
                      ) : node.replacedBy ? (
                        <Link className="small" href={`/${lang}/p/${node.replacedBy}`}>
                          {t.common.replacement(node.replacedBy)}
                        </Link>
                      ) : (
                        <span className="muted small">{t.common.unavailable}</span>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="bom-actions">
        <button className="btn btn-dark" onClick={() => setChecked(allOn ? new Set() : new Set(orderable.map((r) => r.key)))}>
          {t.product.selectAll}
        </button>
        <button className="btn btn-primary" onClick={addSelected}>
          <Cart />
          <span>{t.product.addSelected}</span>
        </button>
        {nSel > 0 && <span className="muted small">{t.product.selected(nSel)}</span>}
      </div>
    </section>
  );
}
