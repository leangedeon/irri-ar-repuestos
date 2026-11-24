import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { get, put } from '@vercel/blob';
import { unstable_cache } from 'next/cache';
import { connection } from 'next/server';

// Ajustes de la tienda (categorías ocultas).
// - En Vercel se guardan en Vercel Blob (store privado conectado al proyecto: variable BLOB_READ_WRITE_TOKEN).
// - Sin Blob (copia local) se guardan en data/tienda/ajustes.json.
// El archivo del repo es además el valor inicial mientras Blob todavía no tiene ajustes.

export type Settings = { ocultas: string[] };

export const SETTINGS_FILE = path.join(process.cwd(), 'data', 'tienda', 'ajustes.json');
const BLOB_PATH = 'ajustes/ajustes.json';
// Token del store. Vercel lo crea como BLOB_READ_WRITE_TOKEN, o con otro prefijo si se eligió uno al conectar el store.
const blobToken = () =>
  process.env.BLOB_READ_WRITE_TOKEN ||
  Object.entries(process.env).find(([k, v]) => k.endsWith('_READ_WRITE_TOKEN') && v?.startsWith('vercel_blob_'))?.[1] ||
  '';
const blobEnabled = () => !!blobToken();

// El store puede haberse creado privado o público: se prueba uno y, si Blob lo rechaza, el otro.
type Access = 'private' | 'public';
let accessFirst: Access = 'private';
async function withAccess<T>(fn: (access: Access) => Promise<T>): Promise<T> {
  try {
    return await fn(accessFirst);
  } catch (e) {
    const other: Access = accessFirst === 'private' ? 'public' : 'private';
    if (!/access|public|private/i.test(String((e as Error)?.message))) throw e;
    const res = await fn(other);
    accessFirst = other;
    return res;
  }
}

const clean = (raw: unknown): Settings => {
  const list = (raw as Partial<Settings> | null)?.ocultas;
  return { ocultas: Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [] };
};

function readFile(): Settings {
  try {
    return clean(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')));
  } catch {
    return { ocultas: [] };
  }
}
const mtimeOf = () => {
  try {
    return fs.statSync(SETTINGS_FILE).mtimeMs;
  } catch {
    return 0;
  }
};

export const SETTINGS_TAG = 'ajustes';

// Lectura de Blob guardada en la caché de datos de Next (compartida entre servidores en Vercel):
// Blob se consulta una sola vez y de nuevo solo después de guardar (updateTag en la acción).
// Así no se gastan operaciones de Blob en cada visita.
const readBlob = unstable_cache(
  async () => {
    const res = await withAccess((access) => get(BLOB_PATH, { access, useCache: false, token: blobToken() }));
    if (!res || res.statusCode !== 200) return null;
    return { data: clean(await new Response(res.stream).json()), etag: res.blob.etag };
  },
  ['ajustes-blob'],
  { tags: [SETTINGS_TAG] }
);

// Copia en memoria: el catálogo la lee de forma sincrónica.
let current: Settings = readFile();
let version = 1;
let source = `file:${mtimeOf()}`;
let etag = '';
let checkedAt = 0;

/** Ajustes vigentes (en memoria). Llamar antes a `refreshSettings()` en cada página. */
export const getSettings = () => current;
/** Cambia cada vez que cambian los ajustes en memoria. */
export const settingsVersion = () => version;

function set(next: Settings, src: string) {
  if (src === source && JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  source = src;
  version++;
}

/** Trae los ajustes si cambiaron (en Vercel, desde la caché de Next; como mucho cada 2 s por servidor). */
export async function refreshSettings(force = false) {
  const now = Date.now();
  if (!force && now - checkedAt < 2000) return;
  checkedAt = now;
  if (!blobEnabled()) {
    const m = mtimeOf();
    if (`file:${m}` !== source) set(readFile(), `file:${m}`);
    return;
  }
  try {
    const res = await readBlob();
    if (!res || res.etag === etag) return; // sin guardar todavía: queda el archivo del repo
    etag = res.etag;
    set(res.data, `blob:${etag}`);
  } catch (e) {
    // Si Blob falla, se sigue mostrando lo último que se leyó.
    console.error('No se pudieron leer los ajustes de Vercel Blob', e);
  }
}

export type WriteResult = { ok: true } | { ok: false; reason: string };

export async function writeSettings(next: Settings): Promise<WriteResult> {
  const body = `${JSON.stringify(next, null, 2)}\n`;
  try {
    if (blobEnabled()) {
      await withAccess((access) =>
        put(BLOB_PATH, body, {
          access,
          token: blobToken(),
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'application/json',
          cacheControlMaxAge: 60,
        })
      );
      etag = '';
      set(next, `saved:${Date.now()}`);
    } else {
      fs.writeFileSync(SETTINGS_FILE, body, 'utf8');
      set(next, `file:${mtimeOf()}`);
    }
    checkedAt = Date.now();
    return { ok: true };
  } catch (e) {
    console.error('No se pudieron guardar los ajustes', e);
    const msg = String((e as Error)?.message ?? e).slice(0, 300);
    // Sin store de Blob en Vercel, el disco es de solo lectura.
    if (!blobEnabled() && /EROFS|read-only|EACCES|EPERM/i.test(msg))
      return { ok: false, reason: 'No hay un store de Vercel Blob conectado a este deploy (falta BLOB_READ_WRITE_TOKEN).' };
    return { ok: false, reason: `${blobEnabled() ? 'Vercel Blob' : 'Archivo'}: ${msg}` };
  }
}

/** Para páginas y rutas: renderiza en cada pedido (no en el build) y con los ajustes al día. */
export async function withSettings() {
  await connection();
  await refreshSettings();
}
