import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Crumbs } from '@/components/ui';
import { SettingsTree, type SettingsNode } from '@/components/settings-tree';
import { db } from '@/lib/catalog';
import { getDict, hasLocale } from '@/lib/i18n';
import { connection } from 'next/server';
import { getSettings, refreshSettings } from '@/lib/settings';
import { saveSettings } from './actions';

export async function generateMetadata({ params }: PageProps<'/[lang]/ajustes'>): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDict(lang).settings.title, robots: { index: false, follow: false } };
}

// Ajustes de la tienda: qué categorías y subcategorías se muestran.
export default async function SettingsPage({ params }: PageProps<'/[lang]/ajustes'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang).settings;
  await connection();
  await refreshSettings(true);
  const { cats, roots } = db();

  // Árbol completo (sin aplicar los ajustes), con la ruta de nombres originales como clave.
  const nodes: SettingsNode[] = [];
  const walk = (id: number, prefix: string): number | null => {
    const c = cats[id];
    if (!c.size) return null;
    const key = prefix ? `${prefix} › ${c.name}` : c.name;
    const idx = nodes.length;
    nodes.push({ key, name: (lang === 'es' && c.nameEs) || c.name, orig: c.name, size: c.size, own: c.parts.length, kids: [] });
    nodes[idx].kids = c.kids.map((k) => walk(k, key)).filter((k): k is number => k != null);
    return idx;
  };
  const top = roots.map((r) => walk(r, '')).filter((k): k is number => k != null);

  return (
    <div className="page">
      <Crumbs lang={lang} items={[{ label: t.title }]} />
      <header className="page-head">
        <h1>{t.title}</h1>
        <p className="muted">{t.lead}</p>
      </header>
      <SettingsTree lang={lang} nodes={nodes} roots={top} hidden={getSettings().ocultas} save={saveSettings} />
    </div>
  );
}
