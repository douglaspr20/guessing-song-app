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


## P0 · Antes de publicarlo en LinkedIn

La gente llega desde el post sin conocer el juego: lo primero que ve es la tarjeta del enlace y la portada, y si muchos entran a la vez el modo abierto tiene que aguantar.

### Presentación

- [ ] **Vista previa al compartir el enlace (S).** Hoy no hay imagen Open Graph ni `openGraph`/`metadataBase` en `src/app/layout.tsx`: LinkedIn, WhatsApp y X muestran el enlace sin imagen. Imagen generada (`opengraph-image` con `ImageResponse`) en el estilo del casete, en español e inglés, más los metadatos `openGraph` y `twitter`.
- [ ] **Icono propio (S).** `src/app/favicon.ico` es el de Next por defecto. Un `icon.svg` y un `apple-icon` con el casete, y borrar los 5 SVG de plantilla de `public/` (no se usan).
- [ ] **README al día (S).** Dice que la interfaz es solo en español; ya es ES/EN. Añadir el enlace a la app y una captura de la estantería y de las playlists como casetes.

### Capacidad

- [ ] **Revisar el aguante del modo abierto ante un pico (S).** La búsqueda de iTunes se llama desde el servidor, así que todas las visitas comparten las IP de Vercel y su límite (responde 403/429, que ya se traduce a `ITUNES_RATE_LIMITED`). Comprobar qué ve el jugador en ese caso, si conviene cachear búsquedas repetidas y si el tope global de 3000 partidas de invitados (`GUEST_LIMITS`) y el plan gratis de Neon bastan. Tener a mano el interruptor «pausar modo abierto» del panel.

### El post (sin código)

- [ ] **Material para el post.** Vídeo de 30-45 s de una partida real (tele + varios móviles pulsando «¡Lo sé!»), 3-4 capturas de apoyo, la historia (por qué y para quién) y tres puntos técnicos: Spotify Web Playback SDK, tiempo real con Ably, CI con e2e y acceso del anfitrión con TOTP.

## P1 · Siguiente: valor alto y esfuerzo bajo

### Medir

- [ ] **Analítica mínima respetuosa (S).** Partidas creadas, terminadas y abandonadas, sin datos personales (eventos personalizados de Vercel Analytics). Hace falta antes del post para saber si atrae y dónde se cae la gente; sin esto, el resto del backlog se ordena a ciegas.
- [ ] **Prueba con grupos reales (S, sin código).** Jugar con 5-10 grupos y anotar qué piden repetir. Decide qué de P2 y P3 importa de verdad.

### Juego

- [ ] **Repetir la última partida con un clic (S).** «Otra igual» en la pantalla final, con los mismos filtros, equipos y ajustes. Hoy «Grabar otra partida» obliga a configurarlo todo de nuevo.
- [ ] **Compartir el resultado (M).** Imagen del podio para enviar al grupo de la familia (reutiliza la generación de imágenes de la vista previa). Es la forma natural de que el juego se difunda solo.
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
