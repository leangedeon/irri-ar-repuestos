'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { db } from '@/lib/catalog';
import { SETTINGS_TAG, writeSettings } from '@/lib/settings';

export type SaveResult = { ok: true; hidden: number } | { ok: false };

// Guarda las categorías ocultas (Vercel Blob en producción, archivo en la copia local).
// Por ahora cualquiera puede guardar; cuando haya login con roles, verificar acá el permiso.
export async function saveSettings(ocultas: string[]): Promise<SaveResult> {
  if (!Array.isArray(ocultas)) return { ok: false };
  const { cats, roots } = db();
  // Solo se aceptan rutas que existen en el catálogo.
  const valid = new Set<string>();
  const walk = (id: number, prefix: string) => {
    const key = prefix ? `${prefix} › ${cats[id].name}` : cats[id].name;
    valid.add(key);
    cats[id].kids.forEach((k) => walk(k, key));
  };
  roots.forEach((r) => walk(r, ''));
  const list = [...new Set(ocultas.filter((k) => typeof k === 'string' && valid.has(k)))].sort();
  if (!(await writeSettings({ ocultas: list }))) return { ok: false };
  updateTag(SETTINGS_TAG);
  revalidatePath('/', 'layout');
  return { ok: true, hidden: list.length };
}
