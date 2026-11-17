'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CONTACT } from '@/lib/config';
import { DICTS, fmt, weightLabel, type Locale } from '@/lib/i18n';
import type { CartProduct } from '@/lib/catalog';
import { useCart } from './cart-context';
import { Img } from './client';
import { Cart, Copy, Layers, Mail, Minus, Plus, Split, Trash, Whatsapp } from './icons';

const FORM_KEY = 'irriar.lindsay.contacto.v1';
type Form = Record<'nombre' | 'empresa' | 'telefono' | 'localidad' | 'comentarios', string>;
const EMPTY: Form = { nombre: '', empresa: '', telefono: '', localidad: '', comentarios: '' };
const imgSrc = (id: string) => (id ? `/img/l/${id}.s.webp` : '/img/sin-imagen.png');

export function CartView({ lang }: { lang: Locale }) {
  const t = DICTS[lang];
  const cart = useCart();
  const [info, setInfo] = useState<Record<string, CartProduct>>({});
  const [form, setForm] = useState<Form>(EMPTY);
  const [err, setErr] = useState('');
  const loaded = useRef<string>('');

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- datos de contacto guardados en el navegador
      setForm({ ...EMPTY, ...JSON.parse(localStorage.getItem(FORM_KEY) || '{}') });
    } catch {}
  }, []);

  // Trae nombre, imagen y despiece de las partes del pedido que todavía no tenemos.
  const missing = cart.lines.map((l) => l.part).filter((p) => !info[p]);
  const key = `${lang}:${missing.join(',')}`;
  useEffect(() => {
    if (!missing.length || loaded.current === key) return;
    loaded.current = key;
    fetch(`/api/products?lang=${lang}&parts=${encodeURIComponent(missing.join(','))}`)
      .then((r) => r.json())
      .then((data: Record<string, CartProduct>) => setInfo((s) => ({ ...s, ...data })))
      .catch(() => {});
  }, [key, lang, missing]);

  const lines = cart.lines.map((l) => ({ ...l, p: info[l.part] })).filter((l) => l.p);
  const pending = cart.lines.length > lines.length;

  if (!cart.ready || (pending && !lines.length)) {
    return (
      <div className="boot">
        <span className="spin" />
        {t.cart.loading}
      </div>
    );
  }

  if (!cart.lines.length) {
    return (
      <div className="empty big">
        <Cart />
        <h1>{t.cart.emptyTitle}</h1>
        <p>{t.cart.emptyLead}</p>
        <Link className="btn btn-primary" href={`/${lang}`}>
          {t.cart.seeCategories}
        </Link>
      </div>
    );
  }

  const totalKg = lines.reduce((a, l) => a + (l.p.lb || 0) * 0.4536 * l.qty, 0);
  const kitLines = lines.filter((l) => l.p.bom.length).length;
  const update = (k: keyof Form, v: string) => {
    const next = { ...form, [k]: v };
    setForm(next);
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify(next));
    } catch {}
  };

  const message = () => {
    const out = [t.cart.msgIntro, ''];
    for (const { part, qty, from, p } of lines) {
      out.push(`• ${qty} × ${part} — ${p.name}${p.bom.length ? ` [${t.cart.msgKit}]` : ''}${from ? ` (${t.cart.msgPieceOf} ${from})` : ''}`);
      if (lang === 'es' && p.name !== p.orig) out.push(`    (${p.orig})`);
      for (const b of p.bom) out.push(`    ◦ ${b.qty == null ? '?' : b.qty * qty} × ${b.part} — ${b.name}`);
    }
    out.push('', `${t.cart.msgName}: ${form.nombre}`);
    if (form.empresa) out.push(`${t.cart.msgCompany}: ${form.empresa}`);
    if (form.localidad) out.push(`${t.cart.msgCity}: ${form.localidad}`);
    if (form.telefono) out.push(`${t.cart.msgPhone}: ${form.telefono}`);
    if (form.comentarios) out.push('', `${t.cart.msgComments}: ${form.comentarios}`);
    return out.join('\n');
  };

  const send = async (kind: 'whatsapp' | 'email' | 'copy') => {
    if (!lines.length) return setErr(t.cart.errEmpty);
    if (!form.nombre.trim()) {
      setErr(t.cart.errName);
      document.querySelector<HTMLInputElement>('input[name="nombre"]')?.focus();
      return;
    }
    setErr('');
    const text = message();
    if (kind === 'whatsapp') window.open(`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    else if (kind === 'email')
      window.location.assign(`mailto:${CONTACT.email}?subject=${encodeURIComponent(t.cart.mailSubject)}&body=${encodeURIComponent(text)}`);
    else {
      try {
        await navigator.clipboard.writeText(text);
        cart.toast(t.toast.orderCopied);
      } catch {
        setErr(t.cart.errCopy);
      }
    }
  };

  return (
    <>
      <header className="page-head">
        <h1>{t.cart.title}</h1>
        <p className="muted">{t.cart.count(lines.length, cart.units)}</p>
      </header>
      <div className="cart">
        <div className="cart-lines">
          <div className="cart-head">
            <span>{t.cart.product}</span>
            <span>{t.cart.qty}</span>
          </div>
          <ul>
            {lines.map(({ part, qty, from, p }) => {
              const href = `/${lang}/p/${encodeURIComponent(part)}`;
              return (
                <li className="cl" key={part}>
                  <Link className="thumb" href={href} tabIndex={-1}>
                    <Img src={imgSrc(p.img)} generic={!p.img} />
                  </Link>
                  <div className="cl-main">
                    <Link className="cl-name" href={href}>
                      {p.name}
                    </Link>
                    {p.name !== p.orig && <span className="orig">{p.orig}</span>}
                    <div className="prow-meta">
                      <span className="code">{part}</span>
                      {p.lb ? <span>{weightLabel(lang, p.lb, qty)}</span> : null}
                      <span>{t.uom[p.uom] ?? p.uom}</span>
                    </div>
                    <div className="chips">
                      {p.bom.length > 0 && (
                        <span className="chip chip-kit">
                          <Layers />
                          {t.common.kitOf(p.bom.length)}
                        </span>
                      )}
                      {p.status === 1 && <span className="chip chip-warn">{t.common.consult}</span>}
                      {from && (
                        <span className="chip">
                          {t.cart.pieceOf} <Link href={`/${lang}/p/${encodeURIComponent(from)}`}>{from}</Link>
                        </span>
                      )}
                    </div>
                    {p.bom.length > 0 && (
                      <details className="cl-kit">
                        <summary>{t.cart.includes(p.bom.length, qty)}</summary>
                        <ul>
                          {p.bom.map((b) => (
                            <li key={b.part}>
                              <b>{b.qty == null ? '—' : fmt(lang, b.qty * qty)}</b>
                              <Link href={`/${lang}/p/${encodeURIComponent(b.part)}`}>{b.name}</Link>
                              <span className="code">{b.part}</span>
                            </li>
                          ))}
                        </ul>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            cart.replace(
                              part,
                              p.bom.map((b) => ({ part: b.part, qty: (b.qty ?? 1) * qty }))
                            );
                            cart.toast(t.toast.exploded(part, p.bom.length));
                          }}
                        >
                          <Split />
                          {t.cart.explode}
                        </button>
                      </details>
                    )}
                  </div>
                  <div className="cl-qty">
                    <div className="stepper">
                      <button onClick={() => cart.set(part, qty - 1)} aria-label={t.cart.removeOne}>
                        {qty > 1 ? <Minus /> : <Trash />}
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={9999}
                        value={qty}
                        onChange={(e) => cart.set(part, Number(e.target.value))}
                        aria-label={t.common.qtyOf(part)}
                      />
                      <button onClick={() => cart.set(part, qty + 1)} aria-label={t.cart.addOne}>
                        <Plus />
                      </button>
                    </div>
                    <button className="link-btn" onClick={() => cart.remove(part)}>
                      {t.cart.remove}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="cart-foot">
            <button className="link-btn" onClick={() => window.confirm(t.cart.clearConfirm) && cart.clear()}>
              {t.cart.clear}
            </button>
            <Link className="link-btn" href={`/${lang}`}>
              {t.cart.keepAdding}
            </Link>
          </div>
        </div>

        <aside className="cart-side">
          <section className="card">
            <h2>{t.cart.summary}</h2>
            <dl className="sum">
              <div>
                <dt>{t.cart.items}</dt>
                <dd>{fmt(lang, lines.length)}</dd>
              </div>
              <div>
                <dt>{t.cart.units}</dt>
                <dd>{fmt(lang, cart.units)}</dd>
              </div>
              {kitLines > 0 && (
                <div>
                  <dt>{t.cart.fullKits}</dt>
                  <dd>{fmt(lang, kitLines)}</dd>
                </div>
              )}
              {totalKg > 0 && (
                <div>
                  <dt>{t.cart.weight}</dt>
                  <dd>{fmt(lang, totalKg, { maximumFractionDigits: 1 })} kg</dd>
                </div>
              )}
              <div className="sum-total">
                <dt>{t.cart.total}</dt>
                <dd>{t.cart.toQuote}</dd>
              </div>
            </dl>
            <p className="muted small">{t.cart.quoteNote}</p>
          </section>
          <form className="card" onSubmit={(e) => e.preventDefault()} noValidate>
            <h2>{t.cart.yourData}</h2>
            <label className="f">
              <span>{t.cart.name}</span>
              <input name="nombre" required autoComplete="name" value={form.nombre} onChange={(e) => update('nombre', e.target.value)} />
            </label>
            <label className="f">
              <span>{t.cart.company}</span>
              <input name="empresa" autoComplete="organization" value={form.empresa} onChange={(e) => update('empresa', e.target.value)} />
            </label>
            <div className="f-row">
              <label className="f">
                <span>{t.cart.phone}</span>
                <input name="telefono" type="tel" inputMode="tel" autoComplete="tel" value={form.telefono} onChange={(e) => update('telefono', e.target.value)} />
              </label>
              <label className="f">
                <span>{t.cart.city}</span>
                <input name="localidad" autoComplete="address-level2" value={form.localidad} onChange={(e) => update('localidad', e.target.value)} />
              </label>
            </div>
            <label className="f">
              <span>{t.cart.comments}</span>
              <textarea name="comentarios" rows={3} placeholder={t.cart.commentsPh} value={form.comentarios} onChange={(e) => update('comentarios', e.target.value)} />
            </label>
            <p className="f-error" role="alert">
              {err}
            </p>
            <button className="btn btn-primary btn-block" type="button" onClick={() => send('whatsapp')}>
              <Whatsapp />
              {t.cart.sendWa}
            </button>
            <div className="f-alt">
              {CONTACT.email && (
                <button className="btn btn-outline" type="button" onClick={() => send('email')}>
                  <Mail />
                  {t.cart.sendMail}
                </button>
              )}
              <button className="btn btn-outline" type="button" onClick={() => send('copy')}>
                <Copy />
                <span>{t.cart.copy}</span>
              </button>
            </div>
          </form>
        </aside>
      </div>
    </>
  );
}
