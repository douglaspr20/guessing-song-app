# Backlog

Estado al 24-10-2026. Marcas: `[x]` hecho, `[ ]` pendiente. Tamaño: S (horas), M (1-2 días), L (varios días).

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

## En curso / por verificar

- [ ] Tras desplegar la rama con `src/lib/db-url.ts`, comprobar en los logs de Vercel que ya no sale el aviso de `pg` sobre `sslmode`.
- [ ] Opcional: pedir a GitHub Support que purgue el commit antiguo `b38baca`.

## Calidad y base técnica

- [ ] **Tests e2e con Playwright (M).** Flujos: invitado juega una partida, miembro se registra con invitación, anfitrión entra, un móvil se une por código y pulsa.
- [ ] **No repetir canciones entre partidas del mismo dueño (M).** Hoy solo evita repetidas dentro de una partida. Necesita historial de pistas por dueño y un límite (por ejemplo, las últimas N partidas) para no agotar el catálogo.
- [ ] **Soporte de varios idiomas (L).** Extraer los textos a un diccionario. Decidir antes qué idiomas y si el reconocimiento de respuestas (`matcher.ts`) necesita ajustes por idioma.

## Contenido y búsqueda

- [ ] **Mejorar la búsqueda (L).**
  - Añadir artistas concretos.
  - Buscar solo entre las más populares.
  - Ajustes especiales por usuario.
  - Respaldo: si en una ronda no se encuentra canción, buscar una parecida.
- [ ] **Vista de playlist tipo casete (M).** Sustituir la lista actual por tarjetas de casete, en línea con el diseño «Casete grabado».

## Anfitrión y miembros

- [ ] **Mejorar la tarjeta de miembros en la vista del anfitrión (S/M).** Con muchos miembros se vuelve molesta: buscador, paginación o lista plegable.
- [ ] **Más miembros con Spotify (S).** El tope de 5 cuentas solo cambia si Spotify concede la cuota ampliada. El código ya está listo; cambiaría solo el panel de Spotify. Según fuentes de terceros exige empresa registrada y unos 250 000 usuarios activos al mes: verificar en la web oficial.

## Estadísticas

- [ ] **Estadísticas entre partidas (L).** Quién gana más, aciertos por género o década, rachas. Cada usuario ya tiene historial, así que hay datos.

## Ideas nuevas (por priorizar)

Valor alto y esfuerzo razonable:

- [ ] **Enlace discreto «Hecho por…» y, si se quiere, «invítame a un café» (S).** Solo en el pie de página y en la pantalla final, nunca durante el juego. Antes: revisar términos de Spotify e impuestos. Mejor esperar a tener usuarios reales.
- [ ] **Prueba con grupos reales (S, sin código).** Jugar con 5-10 grupos y anotar qué piden repetir. Decide qué del backlog importa de verdad.
- [ ] **Analítica mínima respetuosa (S).** Partidas creadas, terminadas y abandonadas, sin datos personales. Sin esto, el backlog se ordena a ciegas.
- [ ] **Repetir la última partida con un clic (S).** «Otra igual» al terminar, con los mismos filtros, equipos y ajustes.
- [ ] **Compartir el resultado (M).** Imagen del podio para enviar al grupo de familia.
- [ ] **Reconexión del móvil (M).** Si un jugador pierde la cookie o cambia de dispositivo, poder reclamar su nombre con un PIN corto de la partida en vez de depender de que el anfitrión lo eche.

Pensando en el futuro:

- [ ] **Modos de juego (M cada uno).** Solo artista, solo década, ronda relámpago, «adivina la letra» (cuidado con derechos de letras).
- [ ] **Partidas pregrabadas por tema (M).** Paquetes por década o género listos para jugar, sin configurar filtros.
- [ ] **Accesibilidad y modo para niños (M).** Dificultad más fácil, pistas más generosas, textos más grandes.
- [ ] **Modo espectador (M).** Ver la partida en una pantalla sin poder pulsar.
- [ ] **Instalable como app (S).** Manifest y service worker para añadirla a la pantalla de inicio.
- [ ] **Contenido con licencia (L, decisión de negocio).** Solo si se quiere monetizar: pedir cotización a proveedores de clips con licencia y consultar a un abogado sobre las vistas previas de iTunes. Ver el análisis de monetización de la conversación.
