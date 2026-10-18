import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Spotify exige 127.0.0.1 (no acepta "localhost") en la redirección del login, así que la app
  // se abre en esa dirección. En desarrollo Next bloquea sus propios recursos si el origen no es
  // "localhost": sin esto la página no llega a cargar su JavaScript.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
