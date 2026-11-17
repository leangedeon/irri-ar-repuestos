# IRRI-AR · Repuestos Lindsay

Tienda de repuestos Lindsay con la estructura de Lindsay Pro y los colores del cotizador IRRI-AR.
Next.js 16 (App Router) + React + TypeScript, en español (`/es`) e inglés (`/en`).

## Correr

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # compilación de producción
```

## Estructura

- `app/[lang]/` páginas: inicio, categoría (`c/[id]`), producto (`p/[part]`), búsqueda y pedido (`cart`).
- `app/api/products` datos de los productos del pedido (el pedido se guarda en el navegador).
- `components/` interfaz; `bom-table.tsx` es el despiece de los conjuntos.
- `lib/catalog.ts` lectura del catálogo en el servidor; `lib/i18n.ts` textos en los dos idiomas.
- `lib/config.ts` WhatsApp y email que reciben los pedidos.
- `proxy.ts` redirige al idioma (cookie elegida o idioma del navegador; por defecto español).
- `public/img/l/` fotos de Lindsay en WebP (`<id>.webp` 640 px y `<id>.s.webp` 200 px).

## Catálogo

`data/tienda/catalog.json` se genera desde la extracción de Lindsay Pro (`data/lindsay/`):

```bash
npm run catalogo
```

Los nombres en español salen de `scripts/i18n/glosario.py` (términos, frases, marcas) y
`scripts/i18n/traducir.py` (traductor y categorías fijadas a mano). Para mejorar una traducción,
agregá el término al glosario o la categoría a `CATEGORIAS` y volvé a generar.

Para ver si quedó alguna palabra en inglés (debe dar 0):

```bash
python3 scripts/i18n/auditar.py
```

## Plataforma anterior

El catálogo con visor 3D del pivot (Vite) quedó en la rama `plataforma-anterior`.
