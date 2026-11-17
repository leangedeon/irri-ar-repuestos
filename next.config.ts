import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // El catálogo es estático y vive en memoria del servidor: usamos el modelo de renderizado clásico.
  cacheComponents: false,
  // El catálogo se lee del disco en el servidor; hay que incluirlo en el despliegue.
  outputFileTracingIncludes: {
    '/**': ['./data/tienda/catalog.json'],
  },
};

export default nextConfig;
