import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Spotify exige 127.0.0.1 (no acepta "localhost") en la redirección del login, así que la app
  // se abre en esa dirección. En desarrollo Next bloquea sus propios recursos si el origen no es
  // "localhost": sin esto la página no llega a cargar su JavaScript.
  // El móvil prueba la partida entrando por la IP del PC en la red local (192.168.x.x).
  allowedDevOrigins: ['127.0.0.1'],
  // La imagen al compartir y el icono del iPhone leen archivos del disco al generarse: que viajen con la función en Vercel.
  outputFileTracingIncludes: {
    '/og/[locale]': ['./src/app/og/_fonts/*.ttf'],
    '/apple-icon': ['./src/app/icon.svg'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Nadie puede incrustar la app en un iframe (clickjacking).
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;
