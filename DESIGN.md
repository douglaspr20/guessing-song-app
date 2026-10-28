---
name: Adivina la canción
description: Cada partida es un casete grabado en casa; la cinta es el reloj y la carátula guarda nombres y puntos.
colors:
  ink: "#1d2747"
  shell: "#26335c"
  shell-hi: "#314172"
  window: "#0f1630"
  card: "#f4eedf"
  card-rule: "#c9c0aa"
  card-ink-soft: "#4a5170"
  field: "#fffaf0"
  saffron: "#f2b632"
  tomato: "#e5482e"
  tomato-deep: "#c23a22"
  on-tomato: "#ffffff"
  sky: "#6fb7e0"
  tape-brown: "#5b3a1e"
  ok: "#2f8f5b"
  bad: "#b3261e"
  on-shell: "#f4eedf"
  on-shell-soft: "#b9c3e3"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(56px, 7.4vw, 104px)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.01em"
  counter:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(40px, 15cqw, 150px)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0.02em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(44px, 5vw, 72px)"
    fontWeight: 800
    lineHeight: 0.95
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    letterSpacing: "0.04em"
  script-name:
    fontFamily: "Kalam, cursive"
    fontSize: "clamp(26px, 2.5vw, 36px)"
    fontWeight: 700
    lineHeight: 1.1
  script-title:
    fontFamily: "Kalam, cursive"
    fontSize: "clamp(38px, 4.6vw, 64px)"
    fontWeight: 700
    lineHeight: 1.02
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "0.1em"
  button:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
rounded:
  tag: "4px"
  step: "10px"
  control: "12px"
  card: "16px"
  shell: "28px"
  pill: "999px"
spacing:
  gap-sm: "10px"
  gap-md: "16px"
  gap-lg: "24px"
  gutter: "clamp(16px, 3.4vw, 48px)"
  band: "92px"
  control-height: "56px"
components:
  button-on-card:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 22px"
    height: "56px"
  button-on-card-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
  button-on-shell:
    backgroundColor: "transparent"
    textColor: "{colors.on-shell}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 22px"
    height: "56px"
  button-on-shell-hover:
    backgroundColor: "{colors.on-shell}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.tomato}"
    textColor: "{colors.on-tomato}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 22px"
    height: "56px"
  button-primary-hover:
    backgroundColor: "{colors.tomato-deep}"
  button-big:
    padding: "16px 32px"
    height: "72px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  tag:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "10px 16px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
  player-chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.script-name}"
    rounded: "{rounded.pill}"
    height: "56px"
  player-chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
  input-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "56px"
  stepper:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "56px"
  cassette-shell:
    backgroundColor: "{colors.shell}"
    rounded: "{rounded.shell}"
  cassette-window:
    backgroundColor: "{colors.window}"
    textColor: "{colors.saffron}"
    typography: "{typography.counter}"
    rounded: "{rounded.pill}"
    width: "min(100%, 900px)"
---

# Design System: Adivina la canción

## Overview

**Creative North Star: "Casete grabado"**

Cada partida es un casete grabado en casa. La pantalla es la carcasa índigo; lo que la familia escribe vive en una carátula de cartulina; tres rayas de cinta (azafrán, tomate, cielo) cruzan cabeceras, lomos y bandas de cierre. La ronda corre en la cinta: dos bobinas se pasan el rollo y un contador mecánico baja dígito a dígito. El sistema rechaza el tablero de trivia de fiesta (temporizador circular, fichas de colores, morado) y el oscuro con verde de las apps de streaming.

La densidad es de salón, no de escritorio: todo se lee a varios metros. La jerarquía se construye solo por escala y por voz tipográfica: lo mecánico (contadores, etiquetas, botones) habla en condensada mayúscula; lo humano (nombres, títulos de canción) está escrito a mano. La profundidad es plana: no hay sombras; la separación la dan el cambio de material (carcasa, ventana, cartulina) y los trazos de tinta de 3px.

**Key Characteristics:**
- Carcasa índigo de fondo, carátula de cartulina como superficie de trabajo.
- Banda de tres rayas de cinta como firma reutilizable.
- Tres voces tipográficas: condensada mayúscula, manuscrita, texto.
- Trazos de tinta de 3px en lugar de sombras.
- Numerales tabulares en todo lo que cuenta.
- Movimiento que nunca oculta contenido.

## Colors

Una carcasa índigo profunda con papel crema encima y tres colores de cinta que cargan significado, no decoración.

### Primary
- **Tomate de cinta** (tomato): la acción principal de cada pantalla (Registrar, Grabar, Empezar) y el contador cuando queda poco tiempo. **Tomate hondo** (tomato-deep) es su hover y la tinta de acento sobre cartulina: números de puesto, «vale N pts», el nombre del ganador. El texto sobre tomate es blanco (on-tomato), siempre a tamaño de botón o mayor.

### Secondary
- **Azafrán de cinta** (saffron): el tiempo y lo activo. Dígitos del contador, cuenta atrás del entreacto, la marca de pista encendida, el borde superior de la barra de acción fija, el destello de la fila que suma, la selección de texto y el anillo de foco sobre la carcasa.

### Tertiary
- **Cielo de cinta** (sky): marcas y rótulos secundarios sobre la carcasa: la leyenda bajo el contador, «Pista N de M» en el entreacto, «Era» en la revelación, iconos de requisitos.

### Neutral
- **Tinta índigo** (ink): fondo de página, tinta de todo lo escrito sobre cartulina y color de los trazos.
- **Carcasa** (shell) y **brillo de carcasa** (shell-hi): el cuerpo del casete y sus tornillos, la pista de marcas apagada, el borde punteado de la estantería vacía.
- **Ventana** (window): la ventana de las bobinas y la barra de acción fija.
- **Cartulina** (card): carátulas, etiquetas, cubos de las bobinas. **Raya de cartulina** (card-rule) para separadores punteados de 2px. **Tinta suave** (card-ink-soft) para títulos de carátula, etiquetas de campo y metadatos. **Campo** (field) es el papel algo más claro dentro de inputs y selects.
- **Papel sobre carcasa** (on-shell) y **papel suave** (on-shell-soft): texto principal y secundario sobre índigo.
- **Cinta marrón** (tape-brown): el rollo magnético de las bobinas y algunos recortes del confeti.
- **Bien** (ok) y **mal** (bad): estados de acierto («+N» del marcador) y de error; siempre acompañados de texto.

### Named Rules
**The Three Stripes Rule.** Las rayas van siempre en el mismo orden, azafrán, tomate, cielo, de arriba abajo, en tercios iguales (0 33.4%, 33.4% 66.7%, 66.7% 100%). Solo existen como banda: cabecera, tapa de carátula, lomo de casete, banda de final.

**The Stripe Roles Rule.** Tomate es acción, azafrán es tiempo y estado activo, cielo es marca. Un color de cinta no cambia de rol entre pantallas. La única excepción deliberada es el podio, donde los tres colores identifican 1º, 2º y 3º junto al número.

## Typography

**Display Font:** Barlow Condensed (con Arial Narrow)
**Body Font:** Barlow (con system-ui)
**Script Font:** Kalam (con cursive)

**Character:** La condensada es la rotulación impresa de la cinta: mecánica, en mayúsculas, espaciada. Kalam es el rotulador del anfitrión en la carátula. Barlow sostiene las frases sin llamar la atención.

### Hierarchy
- **Display** (800, clamp(56px, 7.4vw, 104px), 0.92, mayúsculas): titulares de pantalla de conexión y de escena única (hasta 120px en el entreacto).
- **Counter** (800, clamp(40px, 15cqw, 150px), 0.95, tabular): el contador de la ventana; la cuenta atrás del entreacto llega a clamp(180px, 34vh, 360px). El mismo dígito sirve para reloj, puntos (46px en el marcador) y ronda.
- **Headline** (800, clamp(44px, 5vw, 72px), 0.95, mayúsculas): títulos de página (estantería, grabar partida, final).
- **Title** (800, 28px, 0.04em, mayúsculas): encabezados de sección dentro de una carátula.
- **Script name / Script title** (Kalam 700): nombres de jugador (26 a 36px en el marcador, 30px al escribirlos), título de canción en la etiqueta y en la revelación (hasta 64px), pistas reveladas.
- **Body** (400, 18px, 1.45): texto corrido; ledes a 20 a 24px con máximo 34 a 46ch.
- **Label** (700, 18 a 20px, 0.1em, mayúsculas): etiquetas de campo y metadatos; los títulos de carátula usan 0.18em.
- **Button** (700, 22px, 0.06em, mayúsculas; 28px en la variante grande).

### Named Rules
**The Two Hands Rule.** Lo que escribe una persona (nombres, títulos, pistas) va en Kalam; lo que mide la máquina (tiempo, puntos, puestos, botones, etiquetas) va en Barlow Condensed mayúscula. Los placeholders de campos manuscritos van en Barlow para que un hueco vacío no parezca un nombre escrito.

**The Tabular Rule.** Todo número que cambia o se compara (contador, marcador, stepper, años, puestos) usa numerales tabulares.

## Layout

Contenedor máximo de 1440px centrado con margen lateral fluido (gutter). La banda superior mide 92px (72px en móvil). En juego, columna principal flexible y columna lateral de 320 a 460px para el marcador, pegajosa arriba; pasa a una columna por debajo de 1100px. Grabar partida reparte 5fr y 7fr y se apila por debajo de 1000px, con una barra de acción pegada abajo sobre ventana (sticky, dentro del flujo: al final de la página no tapa nada, mida lo que mida en el móvil). La estantería es una rejilla auto-fill de casetes de mínimo 600px. Los separadores internos son líneas punteadas de 2px en raya de cartulina. Los controles miden 56px de alto como mínimo (48px en móvil para fichas y botones secundarios). Breakpoints observados: 1100px, 1000px, 900px y 640px.

## Elevation & Depth

Sistema plano. No hay box-shadow ni text-shadow en ninguna parte. La profundidad la da el material: ventana (más oscura) dentro de carcasa, dentro de tinta de fondo; la cartulina se separa por contraste y por su banda de rayas. Los tornillos de la carcasa son círculos de brillo de carcasa en sus cuatro esquinas, no relieve.

### Named Rules
**The No Block Shadow Rule.** Sin sombras de bloque ni sombras ambientales; si algo necesita separarse, cambia de material o lleva un trazo de tinta de 3px.

## Shapes

Esquinas de objeto físico: la carcasa a 28px, la carátula a 16px, los controles a 12px, las etiquetas de cinta (marca, catálogo, lomo) casi rectas a 4px, los escalones del podio a 10px arriba. La ventana de las bobinas y las fichas son píldoras (999px); bobinas y cubos son círculos. Los bordes de control son de 3px en el color del texto (currentColor); los chips de filtro bajan a 2px. Las carátulas recortan su contenido (overflow hidden) para que la banda de rayas llegue al borde.

## Components

**En el código.** Los tokens viven en `:root` (`src/app/globals.css`), incluidas las rayas (`--tape-stripes`), los colores de campo y aviso, las alturas de control (`--control-h`, `--control-h-sm`, `--hit-min`) y los radios. Los estilos que se repiten están en una librería de CSS Modules (`src/components/styles/`): `layout` (página, titulares, pie), `form` (campo, etiqueta, input, campo manuscrito) y `controls` (segmentado, chips, botón de icono, botón pequeño). Cada pantalla los reutiliza con `composes:` o con los componentes `Card`, `Notice`, `Field`, `Segmented` y `Chip`. Un patrón nuevo se añade a la librería, no se copia en el módulo de la pantalla.

### Buttons
Etiquetas de cinta que se pulsan: condensada mayúscula, trazo de 3px, sin relleno salvo la acción principal.
- **Shape:** esquinas de control (12px), alto mínimo 56px, icono SVG a la izquierda con 10px de separación.
- **Sobre cartulina:** tinta índigo con trazo; al hover se rellena de tinta y el texto pasa a cartulina.
- **Sobre carcasa:** papel con trazo; al hover se rellena de papel y el texto pasa a tinta.
- **Principal:** relleno tomate, texto blanco; hover a tomate hondo. Una por pantalla.
- **Grande:** 72px de alto, 28px de texto, para la acción decisiva.
- **Estados:** al pulsar baja 2px (translateY); deshabilitado al 45% de opacidad.

### Chips
- **Ficha:** píldora de 44px con trazo de 2px en tinta, Barlow 600 a 17px; elegida (aria-pressed) se rellena de tinta. Queda para elecciones sueltas («¿Eres uno de estos?», en Kalam a 48px); los géneros y las playlists tienen su propia forma (abajo).
- **Fichas de jugador:** radios ocultos sobre píldoras de 56px con trazo de 3px y nombre en Kalam; marcada se rellena de tinta; atajo de teclado (1 a 9) en condensada al 60%. Foco con anillo tomate. Van en orden alfabético fijo (no por puntos), para que cada número sea siempre el mismo jugador.

### De dónde salen las canciones (/new)
- **Lomo de género:** cada género es el lomo de un casete en una estantería. Etiqueta rectangular de 48px con esquinas de etiqueta (4px) y trazo de 2px en tinta; a la izquierda, un bloque de 14px con las tres rayas apiladas (la Three Stripes Rule en vertical, como un lomo); el nombre en condensada 700 mayúscula a 17px. Los lomos se apoyan abajo y cada fila tiene su balda punteada de 2px en raya de cartulina. **Elegido:** se saca 4px de la estantería, se rellena de azafrán (el color de lo activo) y lleva ✓ (icono `Check`); al pasar el ratón sube 2px. Con el máximo de 10 elegidos, los demás se apagan al 45%.
- **Casete de playlist:** cada playlist es un casete de tamaño fijo (proporción 8:5, 4:3 en móvil; rejilla de mínimo 176px, 148px en móvil). Carcasa de 14px con cuatro tornillos; etiqueta de cartulina con la banda de rayas arriba, el nombre en Kalam 700 a 19px centrado (dos líneas como mucho, con «…»; el nombre completo en el `title` y en el nombre accesible) y la ventana con dos bobinas recortada en la etiqueta; abajo, la boca de la cinta con «N CANCIONES» (y «de Ana» en las ajenas) en condensada tabular. **Elegido:** borde de 3px en azafrán, etiqueta ✓ azafrán en la esquina y las bobinas giran despacio (8 s por vuelta; quietas con `prefers-reduced-motion`). Hover: la carcasa pasa a brillo de carcasa. Las ajenas y las que piden reconectar se apagan al 45%. «Canciones que te gustan» lleva un corazón en tomate hondo.

### Equipos
- **Paleta:** ocho colores con nombre (Azafrán, Cielo, Menta, Ciruela, Teja, Pino, Lavanda y Arena), repartidos en ese orden. Ninguno es el tomate, que sigue reservado a la acción principal. El color nunca va solo: siempre acompaña al nombre del equipo.
- **Muestrario:** círculo relleno con el color y trazo de 2px en tinta (`TeamDot`, 12 a 20px). Va antes del nombre en el marcador, las fichas de «¿Quién lo dijo?», el podio, el final y la tarjeta previa a la primera pista.
- **Línea de miembros:** bajo el nombre del equipo, en Kalam a 19px en tinta suave: «Ana, Luis, Marta +2». La fila del marcador es un botón (`aria-expanded`) que despliega la lista completa; nada depende de pasar el ratón, porque en la tele no existe.
- **Editor de equipos (/new):** «Quién juega» conserva su columna, igual que con jugadores sueltos. Una carátula pequeña por equipo, con el color en una franja superior de 10px, el nombre editable en Kalam, el contador n/máx y, por miembro, un selector para cambiarle de equipo y un botón de quitar de 44px. Los avisos (equipo lleno, repetidos) van en línea sobre la cartulina.

- **Adaptación:** en móvil (≤640px) el selector de formato ocupa todo el ancho y cada persona va en una sola línea (nombre, selector de equipo de 112px, quitar de 44px; 48px con dedo); por debajo de 360px el selector baja bajo el nombre. En tableta hay dos equipos por fila y en escritorio tantos como quepan (mín. 260px). El podio final por equipos reparte 5/2 con la columna lateral y se apila por debajo de 900px; en el podio compacto de la estantería el nombre del equipo se corta a dos líneas.

### Unirse desde el móvil
- **Panel «Únete con tu móvil» (tele):** carátula plegable (`<details>`), abierta antes de la primera pista y plegada después, con el código a 72px en condensada con aire entre letras, un QR de 168px en tinta sobre cartulina, «Copiar enlace», «Cerrar entrada» y la lista de quien está dentro (nombre en Kalam, equipo con su muestrario, botón de sacar de 44px).
- **Unirse (`/join`):** una carátula centrada de 640px. El código va en un campo grande (48px, condensada, centrado). Después, el nombre (o «Entras como…» con sesión), fichas «¿Eres uno de estos?» para los nombres que el anfitrión ya apuntó y, por equipos, tarjetas de equipo con trazo de 3px, muestrario, miembros y huecos; el equipo elegido se rellena de tinta.
- **Mando del jugador (`/play`):** columna de 560px: carátula con su nombre y equipo, titular de estado en condensada y el marcador debajo. Es una pantalla de mando: sin atajos de teclado.
- **Unirse en el móvil:** la etiqueta de la banda es corta («Unirse») para caber en la misma fila que la marca; el campo del código lleva puntos como ejemplo (no un código que parezca escrito); y en el paso de nombre y equipo «Entrar» se queda pegado abajo, a todo el ancho y con una raya discontinua encima, para alcanzarlo con el pulgar sin bajar por la lista de equipos.
- **Quién eres en el mando:** el nombre en Kalam a 30px con su muestrario y, debajo, el equipo en condensada pequeña (17px, mayúsculas); nunca en la misma línea, porque los nombres de equipo largos la rompían. Al cerrar una pista dice quién la adivinó («¡La acertó tu equipo!» o «La adivinó Cielo») y al terminar la partida, quién ganó y un «Volver al inicio».
- **Botón «¡Lo sé!»:** la acción principal de la pantalla, en tomate, a todo el ancho y de 280 a 460px de alto (el pulgar acierta sin mirar), con la mano y el texto a 96px en condensada. Apagado pasa a un recuadro de tinta al 10% con el mismo hueco recortado y debajo, en una línea, el motivo («Aún no suena», «Fallaste en esta pista…», «Ana tiene el turno · 12 s»).
- **Tu turno:** cuenta atrás de 140px en condensada (tomate hondo en los últimos 5 s), los campos «Canción» y «Artista» de 64px con Kalam y «Enviar respuesta» en tomate. Al llegar a cero se envía lo escrito.
- **Con el teclado abierto** (`data-typing`): la cuenta atrás baja a 56px y se queda pegada arriba (`sticky`) para que el tiempo siga a la vista, el aviso «Es tu turno» se esconde y el campo tocado se sube al centro; así caben los dos campos y «Enviar respuesta» en 440px de alto. La página se encoge con el teclado (`interactiveWidget: "resizes-content"`) y las alturas del botón grande usan `dvh`.
- **Aviso de conexión:** si se corta el tiempo real aparece, sobre la carátula y en la tele, una nota de estado (icono de wifi tachado) que dice que los móviles se enteran con retraso. Desaparece sola al reconectar.
- **Fragmento acabado:** con el reloj parado y 28 s o más gastados, el botón apagado dice «Se acabó el fragmento: el anfitrión puede repetirlo o revelar la canción», en vez de «El anfitrión pausó la canción».
- **Cartel de turno (tele):** carátula que entra desde arriba (`buzzIn`, sin movimiento con `prefers-reduced-motion`), con el nombre en Kalam hasta 64px, los segundos hasta 112px y una barra de tinta que se vacía con `transform`. «Lo dijo bien» es la acción principal; «Falló» y «Cancelar turno» van de cartulina. Los intentos hechos desde el móvil llevan un icono de móvil junto al nombre.

### Atajos (jugar en la tele)
- **Marca de atajo:** la tecla en condensada a 15px al 60% (`.key`), al final del botón. Si el mando de la tele tiene botón de color para esa acción, la precede un punto de 12px con borde de 2px en el color del mando (rojo Revelar, verde ¡Acertó la canción!, amarillo ¡Acertó el artista!, azul Siguiente). Son los colores del mando, no los de las franjas. En móvil (≤640px) las marcas se ocultan.
- **«¡Acertó!»:** dos botones de cartulina bajo las fichas para dar la canción o el artista al jugador elegido sin escribir. Nunca tomate: el primario sigue siendo «Registrar respuesta». En los intentos aparecen como «la canción, de palabra».
- **Ayuda de atajos:** `<dialog>` nativo con la carátula del diálogo de confirmación (hasta 720px): tabla con cabeceras en condensada, filas separadas por raya discontinua y teclas en cajitas con trazo de 2px. Se abre con ? o H o con el botón «Atajos» del lateral; se cierra con Esc, Atrás o «Entendido».
- **Segmentado:** grupo con trazo de 3px y divisores internos; el botón activo se rellena de tinta.

### Cards / Containers
- **Carátula:** cartulina, esquinas de 16px, tapa de rayas de 36px y título en condensada de 20px a 0.18em en tinta suave. Sin sombra, sin borde.
- **Lomo de casete (estantería):** carátula con banda de rayas que lleva etiquetas de cartulina (fecha, número de catálogo C-NNN a 34px tabular) y podio compacto a la derecha.
- **Estantería vacía:** borde punteado de 3px en brillo de carcasa y banda al 50%.
- **Avisos:** trazo de 3px, icono y texto; error sobre carcasa en rosa sobre burdeos, sobre cartulina en mal sobre rosa pálido.

### Inputs / Fields
- **Campo de texto y select:** fondo campo, trazo de 3px en tinta, esquinas de 12px, 56px, texto a 20px; el select dibuja su flecha con gradientes.
- **Campo manuscrito (nombres, respuestas):** solo subrayado de 3px, texto en Kalam; al foco el subrayado pasa a tomate y el fondo toma un lavado de azafrán al 18%.
- **Stepper:** tres celdas (− valor +) de 56px dentro de un trazo de 3px, valor en condensada 800 a 38px tabular.

### Navigation
- **Banda superior:** banda de rayas de borde a borde, 92px; a la izquierda la marca (el casete de `src/app/icon.svg`, el mismo del favicon, a 1.1em) y a la derecha el estado («C-014 · Lado A · Pista 3 de 10») como etiquetas de cartulina con esquinas de 4px en condensada 800 mayúscula.

### Idioma
El selector **ES · EN** vive en la banda superior, a la derecha de la etiqueta de estado: dos teclas de condensada 800 en mayúscula sobre una etiqueta de cartulina, la activa en tinta sobre cartulina invertida. Cada idioma se nombra en sí mismo (`aria-label` «Español» / «English»). Al cambiar se recarga la página: el servidor pinta todo de nuevo en ese idioma.

**Voz en inglés.** El mismo tono cercano y de casete: frases cortas, segunda persona, sin jerga técnica («Rewinding…», «The tape got tangled», «Record a new game»). Los términos del juego se traducen siempre igual: casete → *cassette*, pista → *track*, estantería → *shelf*, «¡Lo sé!» → *I know it!*, anfitrión → *host*. La marca «Adivina la canción» no se traduce. Las teclas de los atajos son las mismas en los dos idiomas (V, C, A, N siguen los colores del mando).

### «Otra igual» (pantalla final)
Es el botón principal del podio: **Otra igual**, con el icono de rebobinar (`RotateCcw`), en tomate y a tamaño grande. Debajo, «Grabar otra partida» y «Volver a la estantería» como secundarios sobre la cartulina. Mientras graba dice «Grabando…» y queda apagado; un fallo sale como aviso en línea. En el móvil, quien estaba unido ve «El anfitrión grabó otra igual» y «Pasando a la nueva partida…» bajo el podio y entra solo; si no puede, aparece «Unirme a la siguiente».

### Compartir resultado
En la pantalla final, de la tele y de cada móvil, solo hay un botón más: «Compartir resultado» (icono `Share2`, secundario sobre la cartulina), así la pantalla no crece. Al pulsarlo se abre un **modal** (`<dialog>` con `showModal`, como las confirmaciones): tapa de rayas, cabecera fija con el título en condensada y una cruz de 48px, y debajo, separado por una raya discontinua, el contenido, que se desplaza dentro si no cabe. Orden del contenido: vista previa de la tarjeta apaisada (con tope de 42% del alto para el móvil apaisado), el enlace con «Copiar enlace», «Compartir…» (tomate, el menú del móvil; solo si el navegador lo tiene) y «Compartir imagen» (la vertical como archivo; solo si se puede), «Descargar apaisada» y «Descargar vertical», la línea de privacidad («cualquiera con el enlace verá nombres y puntos, nunca canciones») y, en la tele, «Dejar de compartir» en rojo con confirmación. Mide 640px como mucho y deja 16px de margen a los lados y arriba; en pantallas de 480px o menos, cada botón ocupa su fila. Se cierra con Esc, con la cruz o con un clic en lo oscuro, y devuelve el foco al botón. Comprobado de 320×568 a 1920×1080 y en móvil apaisado (844×390 y 667×375), sin desbordes.

### Tarjeta de resultado (imagen y página pública)
La misma composición, dos formatos: **apaisada 1200×630** (vista previa del enlace) y **vertical 1080×1350** (estados e historias). Banda de tres rayas con la etiqueta de la marca; «Fin de la cinta», el titular («Ganó» en cartulina y el nombre grande en azafrán, en condensada 800) y la línea «C-014 · 10 pistas · 28 oct 2026»; el podio de tres escalones (azafrán el 1.º, cielo el 2.º, tomate el 3.º) con el nombre en Kalam y los puntos en azafrán; del 4.º en adelante una lista corta («y N más»: 3 en la apaisada, 4 en la vertical) y el dominio abajo. Los nombres largos bajan de tamaño y se cortan a dos líneas con puntos suspensivos; por equipos salen hasta tres miembros y «+N». Si nadie sumó, solo el titular. La página pública (`/r/<código>`) es la carátula del final sin controles, con el podio a todo el ancho y debajo la invitación «¿Y tú, adivinas la canción?» con «Jugar sin cuenta» y «Unirme con un código».

### Cómo se usa (panel del anfitrión)
Una carátula más del panel (`/host`): selector de periodo (24 h, 7 días, 30 días), ocho cifras grandes (invitados nuevos, creadas, empezadas, terminadas, abandonadas, «Otra igual», móviles unidos y que siguieron), los porcentajes en una línea cada uno y dos tablas sencillas: por modo y formato, y los últimos 14 días. Sin gráficas: con este volumen una tabla se lee mejor. No lleva ningún dato personal.

### Crédito «Hecho por»
Una línea pequeña (16px, texto suave): «Hecho por **Douglas Pérez** · Código en GitHub». El nombre lleva a LinkedIn y el segundo enlace al repositorio; los dos se abren en otra pestaña (con aviso para lectores de pantalla) y tienen la altura de un control pequeño. Solo aparece en la portada, a la izquierda del pie de la estantería y debajo de los botones de la pantalla final (en tinta suave de cartulina). **Nunca durante el juego**, ni en `/new`, `/join` o el panel del anfitrión. Los datos viven en `src/lib/site.ts`.

### Cassette (signature)
La carcasa (28px, tornillos) lleva una etiqueta de cartulina con el título manuscrito y «vale N pts» en tomate hondo. La ventana es una píldora de hasta 900px que se mide a sí misma (container query): bobinas de clamp(48px, 16cqw, 150px) y contador de clamp(40px, 15cqw, 150px), así el contador nunca invade una bobina. El rollo de cada bobina cambia de radio según la cinta que le queda; los dientes del eje giran solo mientras suena. El contador va en azafrán y pasa a tomate con poco tiempo. Debajo, tres marcas de pista (20, 40 y 60 s) con borde superior de 6px que se encienden en azafrán y escriben la pista en Kalam.

### Scoreboard
Carátula con filas: puesto en tomate hondo, nombre manuscrito, puntos a 46px tabulares. Cuando alguien suma, aparece «+N» en verde y la fila se ilumina de azafrán 1,2 s; al reordenarse, las filas se deslizan a su puesto (FLIP con transform) en vez de saltar.

### Podium
Orden 2º, 1º, 3º. Escalones en azafrán (1º), cielo (2º) y tomate con texto blanco (3º), siempre con el número de puesto escrito y corona sobre el primero. Los empates comparten puesto, color de escalón y corona. Si nadie tiene puntos, no se corona a nadie: se escribe «Aún sin puntos» en Kalam. Versiones compacta (estantería) y grande (final), y tono para cartulina o para carcasa.

### Confirmación y avisos
- **Confirmación:** `<dialog>` nativo con `showModal()` (foco atrapado, Esc, fondo inerte). Carátula de cartulina con tapa de rayas, título en condensada 800 de 30px en mayúsculas, texto en Barlow a 19px y separador punteado antes de los botones. «Cancelar» sobre cartulina y la acción en tomate. En las peligrosas el foco empieza en «Cancelar». Los borrados masivos e irreversibles (todo un historial, todos los invitados, un miembro) piden escribir BORRAR; borrar un solo casete basta con confirmar. Todo el foco dentro del diálogo usa el anillo tomate hondo de la cartulina. Si lo que abrió el diálogo desaparece (un casete borrado), el foco vuelve al título de la estantería. Fondo en tinta de ventana al 76%, sin desenfoque. Entra subiendo 14px. Nunca se usan `window.confirm`, `alert` ni `prompt`.
- **Avisos (toasts):** etiqueta de cartulina con trazo de 3px y esquinas de 4px, abajo al centro, con un lomo de rayas a la izquierda (la única banda vertical del sistema: se lee como el lomo de un casete). Icono en bien o mal junto al texto. Los de éxito se van solos a los 4 s; los de error se quedan con botón de cerrar. Máximo tres apilados.
- **Reintentar:** cuando una carga falla, aviso de error (sobre carcasa o sobre cartulina) con el problema y un botón «Reintentar». Una lista que no cargó nunca se presenta como vacía.

### Pantallas de error
Mismo encuadre que la portada: titular display a la izquierda (segunda línea en azafrán) y un objeto a la derecha; en móvil el objeto va arriba y más pequeño. El código («Error 404», «Error 500») va en la etiqueta de estado de la banda, no encima del titular.
- **404, «Esta cinta se perdió»:** cartel de «SE BUSCA» en cartulina, inclinado, pegado con cinta de carrocero (raya de cartulina), con la silueta punteada de un casete, «Casete C-404» en Kalam tomate hondo y «Recompensa: otra partida». Un cabo de cinta marrón se escapa por debajo.
- **500, «Se enredó la cinta»:** casete partido por una grieta, la cinta enredada saliendo por la ventana y un lápiz clavado en la bobina; la carcasa da un respingo al aparecer y el lápiz gira de vez en cuando (solo transform; quieto con movimiento reducido). «Rebobinar» reintenta.

### Motion
- Las entradas solo desplazan o escalan (transform); nunca parten de opacidad 0, así el contenido es visible aunque la animación no corra. Revelación sube 14px, podio sube 24px escalón a escalón (3º, 2º, 1º), el final se pliega con un leve rotateX, la cuenta atrás late desde 1.35.
- Curva única ease-out cubic-bezier(0.16, 1, 0.3, 1); 140 a 160ms para estados, 400 a 700ms para entradas.
- Confeti final: recortes de cinta (tiras de 6 a 12 por 18 a 44px) en los tres colores, cartulina y cinta marrón, 5,2 s con desvanecimiento en el último segundo, sin interceptar clics.
- Con prefers-reduced-motion todas las animaciones y transiciones se reducen a 0.01ms y el confeti no se dibuja.

## Do's and Don'ts

### Do:
- **Do** usar la banda de tres rayas (azafrán, tomate, cielo, en tercios) para cabeceras, tapas de carátula, lomos y la banda de final.
- **Do** reservar tomate para la única acción principal de la pantalla, con texto blanco a 22px o más.
- **Do** escribir nombres, títulos de canción y pistas en Kalam 700, y contadores, puntos, etiquetas y botones en Barlow Condensed mayúscula.
- **Do** usar numerales tabulares en todo número que cambia o se compara.
- **Do** usar trazos de tinta de 3px (currentColor) en controles y separadores punteados de 2px en raya de cartulina.
- **Do** mantener controles de 56px de alto mínimo (48px en móvil).
- **Do** usar anillo de foco azafrán de 3px con 3px de separación sobre la carcasa, y tomate sobre cartulina.
- **Do** acompañar todo color de estado con texto o número: puesto escrito en el podio, «+N» en el marcador, leyenda bajo el contador.
- **Do** animar entradas solo con transform y respetar prefers-reduced-motion.

### Don't:
- **Don't** usar temporizadores circulares, fichas de colores de trivia ni morado.
- **Don't** usar fondos oscuros con acento verde al estilo de las apps de streaming ni imitar la identidad de Spotify.
- **Don't** añadir sombras de bloque ni sombras ambientales; la profundidad es de material.
- **Don't** reordenar las rayas ni cambiar el rol de un color de cinta entre pantallas.
- **Don't** hacer entradas que partan de opacidad 0.
- **Don't** escribir placeholders en Kalam: un hueco vacío no debe parecer un nombre escrito.
