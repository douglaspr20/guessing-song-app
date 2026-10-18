# Adivina la canción 🎵

Juego para reuniones: suena un fragmento (≥ 60 s) de una canción de Spotify y quien la reconozca escribe su nombre. Si acierta, +1 punto.

Stack: Next.js 16 (App Router) · Prisma + SQLite · Spotify Web API + Web Playback SDK.

## Requisitos

- Node 20+
- Cuenta **Spotify Premium** (el Web Playback SDK solo funciona con Premium).

## Configuración

1. Crea una app en <https://developer.spotify.com/dashboard>:
   - **Redirect URI:** `http://127.0.0.1:3000/api/auth/callback` (Spotify no acepta `localhost`).
   - APIs: marca **Web API** y **Web Playback SDK**.
   - En *User Management* añade tu cuenta (la app está en modo desarrollo).
2. Copia `.env.example` a `.env.local` y pon `SPOTIFY_CLIENT_ID` y `SPOTIFY_CLIENT_SECRET`.
3. Instala y crea la base de datos:
   ```bash
   npm install
   npm run db:migrate
   ```
4. Arranca y abre **http://127.0.0.1:3000** (no `localhost`, o la cookie del login no casará):
   ```bash
   npm run dev
   ```
5. En `/play` pulsa *Conectar con Spotify*.

> En Windows, si `prisma migrate` falla con `schema-engine-windows.exe ENOENT`, define
> `PRISMA_SCHEMA_ENGINE_BINARY` con la ruta absoluta a `node_modules\@prisma\engines\schema-engine-windows.exe`.

## Cómo funciona

1. `POST /api/games` crea la partida (jugadores, rondas, segundos de fragmento, filtros).
2. `POST /api/games/:id/rounds` elige una canción al azar según los filtros (sin repetir) y un punto de inicio aleatorio.
3. El navegador crea un dispositivo con el Web Playback SDK y llama a `POST .../rounds/:rid/play` con su `deviceId`; el servidor ordena a Spotify reproducir desde `startMs` y el cliente pausa a los N segundos.
4. `POST .../rounds/:rid/guesses` valida la respuesta (sin tildes, sin "- Remastered", "(feat. …)", tolerante a erratas). El primero que acierta gana el punto y cierra la ronda.
5. `POST .../rounds/:rid/reveal` cierra la ronda sin ganador. Al cerrar la última, la partida pasa a `FINISHED`.

### Reglas de puntuación

- El reloj de la ronda empieza la primera vez que suena el fragmento (repetirlo no lo reinicia).
- **Título:** 3 pts antes de 20 s, 2 antes de 40 s, 1 después. Solo el primero que acierta; acertar cierra la ronda.
- **Artista:** +1, independiente del título, para el primero que lo acierte y solo antes de los 40 s.
- **Pistas:** 20 s → número de palabras del título, 40 s → artista, 60 s → primeras letras (`D_ M_____ L_____`).
- **Corrección manual:** el anfitrión puede dar por bueno un título o artista rechazado; puntúa según el segundo en que se hizo el intento.
- La siguiente canción se elige en segundo plano, así que la nueva ronda empieza al instante.

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/auth/login` | Login con Spotify |
| GET | `/api/auth/status` | ¿Conectado? ¿Premium? |
| POST | `/api/auth/logout` | Olvida los tokens |
| GET | `/api/spotify/token` | Token para el SDK |
| GET | `/api/spotify/genres` | Géneros, idiomas y décadas para filtros |
| GET | `/api/spotify/playlists` | Tus playlists |
| POST | `/api/spotify/sample` | Prueba filtros: devuelve la canción que saldría |
| POST | `/api/games` | Crear partida |
| GET / PATCH | `/api/games/:id` | Estado / cambiar filtros |
| POST | `/api/games/:id/players` | Añadir jugador |
| POST | `/api/games/:id/rounds` | Siguiente ronda |
| POST | `/api/games/:id/rounds/:rid/play` | Reproducir fragmento `{ deviceId }` |
| GET / POST | `/api/games/:id/rounds/:rid/guesses` | Ver intentos / adivinar `{ playerId, title?, artist? }` |
| POST | `/api/games/:id/rounds/:rid/guesses/:guessId/accept` | Dar por bueno `{ title?: true, artist?: true }` |
| POST | `/api/games/:id/rounds/:rid/reveal` | Revelar |

### Filtros

```jsonc
{
  "source": "search",          // o "playlists"
  "genres": ["rock en espanol", "pop"],
  "language": "es",            // es, es-latam, en, pt, fr, it, de, ko, ja
  "market": "AR",              // opcional, tiene prioridad sobre language
  "yearFrom": 1980, "yearTo": 1999,
  "keywords": "soda stereo",
  "minPopularity": 40,
  "playlistIds": []            // obligatorio si source = "playlists"
}
```

Spotify no tiene campo de idioma: `language` solo elige el mercado de búsqueda. Para filtrar por idioma de verdad, usa **playlists propias** como fuente (p. ej. "Clásicos en español").

## Estructura

```
src/lib/spotify/   auth (OAuth + refresh), client (fetch con reintentos), sources (search/playlists), playback
src/lib/game/      service (casos de uso), track-picker, matcher, filters (zod), events (bus para realtime futuro)
src/app/api/       route handlers delgados
src/hooks/         useSpotifyPlayer (Web Playback SDK)
src/app/play/      panel de pruebas (sin diseño)
```

## Tests

```bash
npm test
npm run typecheck
```

## Futuro: jugar desde el móvil

`Game.code` ya existe y toda la lógica vive en `service.ts`. Para multi-dispositivo bastará con un endpoint "unirse por código" y un canal SSE/WebSocket que se suscriba a `events.ts`. El audio seguirá sonando solo en el dispositivo anfitrión.
