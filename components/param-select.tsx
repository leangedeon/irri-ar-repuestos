'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Selector que cambia un parámetro de la URL (orden, cantidad por página) y vuelve a la página 1.
export function ParamSelect({ name, value, options }: { name: string; value: string; options: [string, string][] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <select
      value={value}
      onChange={(e) => {
        const q = new URLSearchParams(params);
        q.set(name, e.target.value);
        q.delete('pag');
        router.push(`${pathname}?${q}`, { scroll: false });
      }}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
