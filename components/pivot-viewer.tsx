'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fmt, type Locale } from '@/lib/i18n';
import { ZONE_LABEL, ZONES, type Zone } from '@/lib/zones';
import { Close, Pin } from './icons';
import type { SceneApi, Spot } from './pivot/scene';

type Props = {
  lang: Locale;
  /** 'filter': tocar una zona filtra el listado de esta página (?zona=). 'link': lleva a la página de la zona. */
  mode: 'filter' | 'link';
  /** Zonas del contexto (la categoría o el producto que se está viendo). */
  active?: Zone[];
  /** Cantidad de productos por zona en el listado; las zonas sin productos no se pueden tocar. */
  counts?: Partial<Record<Zone, number>>;
  /** Filtro actual (?zona=). */
  selected?: Zone | null;
  /** Qué se está viendo, para el texto "sin vista previa". */
  subject?: string;
  big?: boolean;
};

const TXT = {
  es: {
    title: 'Ubicación en el pivot',
    hint: 'Tocá una parte del equipo para ver sus repuestos.',
    hintFilter: 'Tocá una parte del equipo para filtrar esta lista.',
    noPreview: 'Sin vista previa',
    noPreviewOf: (s: string) => `No tenemos la ubicación de ${s} en el equipo.`,
    here: 'Está en',
    filtering: 'Filtrando por',
    clear: 'Quitar filtro',
    products: (n: number) => `${n} ${n === 1 ? 'producto' : 'productos'}`,
    see: 'Ver repuestos',
    zones: 'Partes del equipo',
    fallback: 'Tu navegador no puede mostrar el modelo 3D. Elegí una parte:',
  },
  en: {
    title: 'Location on the pivot',
    hint: 'Tap a part of the machine to see its parts.',
    hintFilter: 'Tap a part of the machine to filter this list.',
    noPreview: 'No preview',
    noPreviewOf: (s: string) => `We don’t have the location of ${s} on the machine.`,
    here: 'Located at',
    filtering: 'Filtering by',
    clear: 'Clear filter',
    products: (n: number) => `${n} ${n === 1 ? 'product' : 'products'}`,
    see: 'See parts',
    zones: 'Machine parts',
    fallback: 'Your browser can’t show the 3D model. Pick a part:',
  },
};

export function PivotViewer({ lang, mode, active = [], counts, selected = null, subject, big = false }: Props) {
  const t = TXT[lang];
  const labels = ZONE_LABEL[lang];
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spotsRef = useRef<Partial<Record<Zone, HTMLButtonElement | null>>>({});
  const tipRef = useRef<HTMLDivElement>(null);
  const tipAt = useRef({ x: 0, y: 0 });
  const spotAt = useRef<Partial<Record<Zone, { x: number; y: number }>>>({});

  // Ubica el tooltip junto al puntero sin que se salga del visor (se da vuelta cerca de los bordes).
  const placeTip = () => {
    const tip = tipRef.current;
    const host = hostRef.current;
    if (!tip || !host) return;
    const { x, y } = tipAt.current;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const W = host.clientWidth;
    const H = host.clientHeight;
    let tx = x + 14;
    if (tx + w > W - 8) tx = x - 14 - w;
    tx = Math.max(8, Math.min(tx, W - w - 8));
    let ty = y - h - 10;
    if (ty < 8) ty = y + 16;
    ty = Math.max(8, Math.min(ty, H - h - 8));
    tip.style.transform = `translate(${tx}px, ${ty}px)`;
  };
  const apiRef = useRef<SceneApi | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [hover, setHover] = useState<Zone | null>(null);

  const enabled = (z: Zone) => !counts || (counts[z] ?? 0) > 0;
  const shown = selected ? [selected] : active;
  const shownKey = shown.join();

  const go = (z: Zone | null) => {
    if (mode === 'link') {
      if (z) router.push(`/${lang}/z/${z}`);
      return;
    }
    const q = new URLSearchParams(params.toString());
    q.delete('pag');
    if (!z || z === selected) q.delete('zona');
    else q.set('zona', z);
    const s = q.toString();
    router.push(`${pathname}${s ? `?${s}` : ''}`, { scroll: false });
  };

  // Refs para que la escena (creada una vez) use siempre los valores actuales.
  const goRef = useRef(go);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    goRef.current = go;
    enabledRef.current = enabled;
  });

  useEffect(() => {
    let api: SceneApi | null = null;
    let dead = false;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    import('./pivot/scene')
      .then(({ createScene }) => {
        if (dead) return;
        api = createScene(host, canvas, {
          onPick: (z) => goRef.current(z),
          isEnabled: (z) => enabledRef.current(z),
          onHover: (z, x, y) => {
            setHover(z);
            if (z) {
              tipAt.current = { x, y };
              placeTip();
            }
          },
          onSpots: (list: Spot[]) => {
            for (const s of list) {
              const el = spotsRef.current[s.zone];
              if (!el) continue;
              el.style.transform = `translate(${s.x}px, ${s.y}px)`;
              spotAt.current[s.zone] = { x: s.x, y: s.y };
              el.dataset.off = s.show ? '' : '1';
            }
          },
        });
        apiRef.current = api;
        api.setActive(shownKey ? (shownKey.split(',') as Zone[]) : []);
        setState('ready');
      })
      .catch(() => !dead && setState('failed'));
    return () => {
      dead = true;
      api?.dispose();
      apiRef.current = null;
    };
    // La escena se crea una sola vez; los cambios de zona van por setActive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar el texto cambia el ancho: se vuelve a ubicar.
  useLayoutEffect(() => {
    if (hover) placeTip();
     
  }, [hover]);

  useEffect(() => {
    apiRef.current?.setActive(shownKey ? (shownKey.split(',') as Zone[]) : []);
  }, [shownKey]);

  const noPreview = !selected && !active.length && !!subject;
  const count = (z: Zone) => counts?.[z];

  const caption = (() => {
    if (selected)
      return (
        <>
          <span className="pv-ic on">
            <Pin />
          </span>
          <span className="pv-txt">
            <small>{t.filtering}</small>
            <b>{labels[selected]}</b>
          </span>
          <button className="btn btn-ghost btn-sm pv-clear" onClick={() => go(null)}>
            <Close />
            {t.clear}
          </button>
        </>
      );
    if (active.length)
      return (
        <>
          <span className="pv-ic on">
            <Pin />
          </span>
          <span className="pv-txt">
            <small>{t.here}</small>
            <b>{active.map((z) => labels[z]).join(' · ')}</b>
          </span>
          {mode === 'link' && pathname !== `/${lang}/z/${active[0]}` && (
            <Link className="btn btn-ghost btn-sm" href={`/${lang}/z/${active[0]}`}>
              {t.see}
            </Link>
          )}
        </>
      );
    return (
      <>
        <span className="pv-ic">
          <Pin />
        </span>
        <span className="pv-txt">
          {noPreview ? (
            <>
              <b>{t.noPreview}</b>
              <small>{t.noPreviewOf(subject!)}</small>
            </>
          ) : (
            <small>{mode === 'filter' ? t.hintFilter : t.hint}</small>
          )}
        </span>
      </>
    );
  })();

  return (
    <section className={`pv ${big ? 'pv-big' : ''}`} aria-label={t.title}>
      <div ref={hostRef} className={`pv-stage ${state}`}>
        <canvas ref={canvasRef} aria-hidden="true" />
        <div className="pv-spots">
          {ZONES.map((z, i) => {
            const n = count(z);
            const on = enabled(z);
            return (
              <button
                key={z}
                ref={(el) => {
                  spotsRef.current[z] = el;
                }}
                className={`pv-spot ${shown.includes(z) ? 'active' : ''} ${hover === z ? 'hover' : ''}`}
                data-off="1"
                disabled={!on}
                aria-pressed={mode === 'filter' ? selected === z : undefined}
                aria-label={`${labels[z]}${n != null ? ` · ${t.products(n)}` : ''}`}
                onClick={() => go(z)}
                onMouseEnter={() => {
                  setHover(z);
                  const at = spotAt.current[z];
                  if (at) tipAt.current = at;
                }}
                onMouseLeave={() => setHover(null)}
              >
                <span>{i + 1}</span>
              </button>
            );
          })}
        </div>
        <div ref={tipRef} className={`pv-tip ${hover && state === 'ready' ? 'show' : ''}`} aria-hidden="true">
          {hover && (
            <>
              {labels[hover]}
              {count(hover) != null && <small>{fmt(lang, count(hover)!)}</small>}
            </>
          )}
        </div>
        {state === 'failed' && (
          <div className="pv-fallback">
            <p>{t.fallback}</p>
            <div>
              {ZONES.filter(enabled).map((z) => (
                <button key={z} className={`pv-chip ${shown.includes(z) ? 'on' : ''}`} onClick={() => go(z)}>
                  {labels[z]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="pv-cap">{caption}</div>
    </section>
  );
}
