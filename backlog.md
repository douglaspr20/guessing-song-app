# Backlog

Estado al 27-10-2026. Marcas: `[x]` hecho, `[ ]` pendiente. Tamaño: S (horas), M (1-2 días), L (varios días). Lo pendiente va por prioridad (P0 primero) y, dentro de cada una, por categoría.

## Hecho

- [x] Atajos de teclado y mando para la tele (siguiente, pausar, revelar, elegir jugador).
- [x] Equipos además de jugadores sueltos (reparto al azar o manual, color, miembros).
- [x] Unirse desde el móvil con el código o QR. Tiempo real con Ably en vez de SSE, con respaldo por sondeo cada 3 s.
- [x] Pulsador «¡Lo sé!» con tiempo de respuesta ajustable y bloqueo al fallar.
- [x] Tercera entrega de pulido en móvil (`feat/polish-mobile`, pendiente de merge).
- [x] Google OAuth en producción: URI de redirección registradas y pantalla de consentimiento publicada.
- [x] Impeccable actualizado a la versión 4.7.0.
- [x] Cron de limpieza de Vercel ejecutado a mano y funcionando (llega a la base de datos tras validar `CRON_SECRET`).
- [x] Probar el aviso de «conexión perdida» cortando el wifi de verdad.
- [x] Probar el teclado en un iPhone real.
- [x] Probar el pulsador con varios móviles a la vez.
- [x] Poner `ABLY_API_KEY` en Vercel (marcada como Sensitive).
- [x] Compartir el resultado: botón en la tele y en cada móvil que crea un enlace público (`/r/<código>`, sin canciones ni datos internos) con vista previa en WhatsApp, LinkedIn y X, y la tarjeta como imagen apaisada o vertical para descargar o compartir; el anfitrión puede dejar de compartir.
- [x] Analítica mínima propia (`GameEvent`, sin datos personales): invitados nuevos, partidas creadas, empezadas, terminadas y abandonadas, desglose por modo y formato, móviles y los últimos 14 días, en «Cómo se usa» del panel del anfitrión. Los eventos personalizados de Vercel no están en el plan Hobby.
- [x] «Otra igual» en la pantalla final: la misma partida (ajustes, filtros y personas) con un clic, y los móviles unidos pasan solos a la nueva.
- [x] Vista previa al compartir: imagen Open Graph por idioma (`/og/es`, `/og/en`, generada con `ImageResponse` y las tipografías de la app), metadatos `openGraph` y `twitter`, e icono propio del casete (`icon.svg` y `apple-icon`). Fuera el favicon de Next y los SVG de plantilla. README con el enlace a la app y capturas nuevas.
- [x] Crédito discreto «Hecho por Douglas Pérez · Código en GitHub» en la portada, el pie de la estantería y la pantalla final (nunca durante el juego).
- [x] Playlists como casetes de tamaño fijo (nombre centrado y recortado, bobinas que giran al elegirlas) y géneros como lomos de una estantería.
- [x] Analítica de Vercel (visitas sin cookies) y Speed Insights, solo en Vercel y con las URL limpias de ids y códigos; el panel del anfitrión no se mide.
- [x] Refactor de componentes y estilos: pantallas grandes partidas (`_components/`, `_hooks/`, `_lib/` por ruta), componentes y hooks compartidos, y librería de estilos (`src/components/styles/`) con tokens nuevos.
- [x] Interfaz en español e inglés: idioma del navegador o selector ES · EN (cookie), cada dispositivo con el suyo y errores de la API traducidos. Añadir un idioma es copiar `src/i18n/messages/en/` (ver README).
- [x] Tests e2e con Playwright (invitado juega, miembro se registra con invitación, anfitrión entra, un móvil se une por código y pulsa), dentro del CI con el check `ci-ok`, y workflow que refleja el despliegue de Vercel.
- [x] Bases de las previews: la integración de Neon ya crea una rama de base por cada despliegue de preview (`preview/<rama>`), así que las migraciones y los datos de un PR no tocan producción.
- [x] En GitHub (_Settings → Branches_), proteger `master`: exigir pull request y el check `ci-ok`
- [x] Tras fusionar `fix/vercel-status-check`, comprobar que en el siguiente despliegue aparece el check «Despliegue en Vercel» en el commit (Vercel informa con un estado de commit, no con «deployments»; el workflow anterior no se activaba nunca).
- [x] En Vercel, activar _Analytics_ y _Speed Insights_ en el proyecto (pestañas del mismo nombre) para que empiecen a recoger datos.
- [x] **Comprobar la tarjeta en LinkedIn (sin código).** Tras desplegar `feat/share-preview`, pegar la URL en el [Post Inspector](https://www.linkedin.com/post-inspector/) para ver la tarjeta real y refrescar su caché.

## P0 · Antes de publicarlo en LinkedIn

La gente llega desde el post sin conocer el juego: lo primero que ve es la tarjeta del enlace y la portada, y si muchos entran a la vez el modo abierto tiene que aguantar.

### Capacidad

- [x] **Aguante del modo abierto ante un pico (S).**
  - **Caché de búsquedas de iTunes en Postgres** (`ItunesSearch`): 6 h de frescura y, si iTunes falla, se juega con lo último guardado.
  - **Tope en «Probar filtros»:** 20 por hora sin invitación.
  - **Aviso de iTunes limitado más claro**, con su e2e simulada.
  - **Prueba de carga local** (`scripts/load-open-mode.mjs`, iTunes falso): 100 invitados jugando a la vez completaron 100/100 partidas, con p95 por debajo de 0,8 s en un solo proceso local.
- [x] **Tope de invitados por IP subido de 10 a 30 al día.** En la prueba de carga, de 15 personas detrás de una misma IP (una oficina o una universidad) se quedaban fuera 7.

### El post (sin código)

- [ ] **Material para el post.** Vídeo de 30-45 s de una partida real (tele + varios móviles pulsando «¡Lo sé!»), 3-4 capturas de apoyo, la historia (por qué y para quién) y tres puntos técnicos: Spotify Web Playback SDK, tiempo real con Ably, CI con e2e y acceso del anfitrión con TOTP.

## P1 · Siguiente: valor alto y esfuerzo bajo

### Medir

- [ ] **Prueba con grupos reales (S, sin código).** Jugar con 5-10 grupos y anotar qué piden repetir. Decide qué de P2 y P3 importa de verdad.

### Juego

- [ ] **Reconexión del móvil (M).** Si un jugador pierde la cookie o cambia de dispositivo, reclamar su nombre con un PIN corto de la partida en vez de depender de que el anfitrión lo eche.

## P2 · Después: mejora la experiencia de quien ya juega

### Contenido y búsqueda

- [ ] **No repetir canciones entre partidas del mismo dueño (M).** Hoy solo evita repetidas dentro de una partida. Necesita historial de pistas por dueño y un límite (por ejemplo, las últimas N partidas) para no agotar el catálogo.
- [ ] **Mejorar la búsqueda (L).** Empezar por el respaldo, que evita rondas fallidas; lo demás según lo que pidan los grupos.
  - Respaldo: si en una ronda no se encuentra canción, buscar una parecida.
  - Añadir artistas concretos.
  - Buscar solo entre las más populares.
  - Ajustes especiales por usuario.

### Plataforma

- [ ] **Instalable como app (S).** Manifest y service worker para añadirla a la pantalla de inicio. Barato y se nota en el móvil; comparte el icono de P0.

### Estadísticas

- [ ] **Estadísticas entre partidas (L).** Quién gana más, aciertos por género o década, rachas. Cada usuario ya tiene historial, así que hay datos.

### Anfitrión y miembros

- [ ] **Mejorar la tarjeta de miembros en la vista del anfitrión (S/M).** Con muchos miembros se vuelve molesta: buscador, paginación o lista plegable. Baja prioridad mientras los miembros sean pocos.

## P3 · Futuro: según lo que pidan los grupos

### Modos y contenido

- [ ] **Modos de juego (M cada uno).** Solo artista, solo década, ronda relámpago, «adivina la letra» (cuidado con derechos de letras).
- [ ] **Partidas pregrabadas por tema (M).** Paquetes por década o género listos para jugar, sin configurar filtros. Buena entrada para quien llega sin saber qué elegir.

### Accesibilidad y público

- [ ] **Accesibilidad y modo para niños (M).** Dificultad más fácil, pistas más generosas, textos más grandes.
- [ ] **Modo espectador (M).** Ver la partida en una pantalla sin poder pulsar.

## Bloqueado o decisión de negocio

No dependen del código: esperan a terceros, a usuarios reales o a una decisión.

- [ ] **«Invítame a un café» (S).** Junto al crédito «Hecho por», nunca durante el juego. Antes: revisar términos de Spotify e iTunes (cobrar dentro de la app) e impuestos. Mejor esperar a tener usuarios reales.
- [ ] **Más miembros con Spotify (S).** El tope de 5 cuentas solo cambia si Spotify concede la cuota ampliada. El código ya está listo; cambiaría solo el panel de Spotify. Según fuentes de terceros exige empresa registrada y unos 250 000 usuarios activos al mes: verificar en la web oficial.
- [ ] **Contenido con licencia (L).** Solo si se quiere monetizar: pedir cotización a proveedores de clips con licencia y consultar a un abogado sobre las vistas previas de iTunes. Ver el análisis de monetización de la conversación.
