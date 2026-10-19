# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Familias en reuniones: todo público, de niños a abuelos, jugando juntas. Una persona hace de anfitrión y maneja la app; el resto mira, escucha y grita respuestas. Se juega tanto con un portátil conectado a la TV (lectura desde el sofá, a varios metros) como con un portátil en la mesa con la gente alrededor.

## Product Purpose

Juego de "adivina la canción": suena un fragmento de al menos 60 s de una canción de Spotify y quien la reconoce dice el título y/o el artista. El anfitrión registra quién acertó y la app reparte puntos. El éxito es que la familia se ría, compita y quiera otra partida.

## Positioning

Usa la cuenta Spotify Premium del anfitrión, sus playlists y sus canciones que le gustan, así que la música es la de esa familia, no un catálogo genérico. La puntuación premia la rapidez y las pistas progresivas mantienen viva cada ronda para todas las edades.

## Operating Context

- Un único dispositivo anfitrión (v1). En el futuro, los jugadores se unirán desde su móvil con un código de partida.
- Flujo: conectar Spotify → historial de partidas → configurar partida (jugadores, rondas, segundos de fragmento, filtros) → rondas → podio final.
- Ambiente ruidoso, luz de salón, varias personas mirando a la vez; el anfitrión escribe rápido mientras la canción suena.

## Capabilities and Constraints

- Next.js 16 (App Router) + Prisma/PostgreSQL; reproducción en el navegador con el Web Playback SDK (requiere Spotify Premium y un navegador con DRM: Chrome o Edge).
- Puntos: título 3/2/1 según se acierte antes de 20 s, antes de 40 s o después; +1 por artista (primero que lo acierte, antes de 40 s). El reloj empieza la primera vez que suena el fragmento.
- Pistas cada 20 s: género, artista, primeras letras del título.
- El anfitrión puede dar por buena una respuesta rechazada.
- Filtros: búsqueda general (géneros, idioma aproximado por mercado, años, palabra clave) o playlists propias, incluida "Canciones que te gustan".
- La siguiente canción se precarga.
- Fragmento de 60 a 180 s; 1 a 50 rondas; 1 a 20 jugadores.

## Brand Commitments

- Nombre: "Adivina la canción". Sin logo, colores ni estilo fijados; no debe imitar la identidad de Spotify.
- Idioma de la interfaz: español.

## Evidence on Hand

No hay capturas, testimonios ni recursos gráficos. Las portadas de los álbumes llegan desde Spotify en cada ronda.

## Product Principles

1. Se lee desde el sofá: lo importante de cada pantalla se entiende a varios metros.
2. El anfitrión no debe frenar el juego: registrar un acierto es rápido y a prueba de dedos torpes.
3. La tensión es parte del juego: cuentas atrás, pistas y revelaciones se escenifican.
4. Para toda la familia: nada exige saber inglés, leer mucho o entender tecnología.

## Accessibility & Inclusion

Todo público con mayores entre los jugadores: texto grande, contraste alto y la información crítica (tiempo, puntos, ganador) nunca solo por color. Respetar `prefers-reduced-motion` en confeti y animaciones.
