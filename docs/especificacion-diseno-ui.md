# DETECTA · Especificación de diseño de la interfaz para el front (F5b-diseño)

Documento de entrada para el agente de código. Describe **qué** debe verse y comportarse distinto en `front/src`, tomando como referencia los mockups aprobados (Lotes 1 a 6). No describe cómo programarlo: el agente debe proponer el plan primero y esperar aprobación (ver sección 9).

Estado: borrador para aprobación de Ivan (incluye el Lote 6, pantallas de inicio, aprobado). Los mockups y el sistema de diseño viven en artefactos de claude.ai que el agente no puede abrir; por eso este documento contiene todos los valores y reglas necesarios.

---

## 1. Reglas que no se negocian

1. **No cambian** las rutas existentes (solo se agrega una ruta nueva de inicio por rol, ver 7.0), los nombres `IU_*`, los contratos con la API, los identificadores del DOM que usan las pruebas ni la lógica de negocio.
2. **No cambian los textos** de `textos.ts` y `componentes/etiquetas.ts`, salvo los listados en la sección 8 (textos nuevos provisionales).
3. Se conservan: `aria-current="page"` en el enlace activo, `data-rotulo` en celdas, encabezados `th scope`, foco visible, devolución de foco al cerrar formularios, y el id del estudiante fuera del DOM (ajuste C de F2).
4. Las pruebas existentes (`npm test`) deben seguir pasando. Si una prueba depende de la estructura visual (por ejemplo, el encabezado o el `nav`), se actualiza **solo** esa prueba y se informa.
5. El diseño sigue siendo **responsivo y primero para celular** (ER 1.3.3, 3.3.4). Los mockups son de escritorio; el comportamiento en pantallas pequeñas se define en la sección 3.2.
6. Contraste AA en texto y en bordes de controles; área táctil mínima de 44 px (excepción acotada: botón de fila en tablas compactas, 36 px, solo en escritorio).
7. Un solo botón primario por pantalla.
8. El significado de un estado de riesgo **nunca** depende solo del color: siempre ícono y texto.

---

## 2. Tokens (`estilos/base.css`)

Principio: **conservar los nombres de variables existentes** y añadir los nuevos, para no tocar los módulos CSS de cada rol más de lo necesario. Los valores nuevos reemplazan a los actuales.

### 2.1 Color

| Variable | Valor | Uso |
|---|---|---|
| `--color-fondo` | `#f4f6fa` | Fondo de la aplicación (antes `#f6f7f9`) |
| `--color-superficie` | `#ffffff` | Tarjetas, barra lateral, tablas |
| `--color-texto` | `#1b2430` | Texto principal (antes `#1b1f24`) |
| `--color-texto-suave` | `#4a5565` | Texto de apoyo y ayudas (antes `#4a5260`) |
| `--color-texto-rotulo` (nuevo) | `#5b6575` | Rótulos de columna y metadatos |
| `--color-borde` | `#8a94a3` | **Solo bordes de controles** (campos, botón secundario) |
| `--color-borde-suave` (nuevo) | `#e3e8f0` | Bordes decorativos de tarjetas, separadores de tabla, barra lateral |
| `--color-primario` | `#0b5cad` | Único color de acción |
| `--color-primario-hover` (nuevo) | `#08457f` | Hover/pressed de botón y enlaces |
| `--color-primario-tinte` (nuevo) | `#e7f0fa` | Hover del menú, selección suave, filas resaltadas |
| `--color-avatar` (nuevo) | `#e3eefa` | Avatar con iniciales y pista de barras de progreso |
| `--color-marca` (nuevo) | `#14305c` | Texto «DETECTA» de marca (azul marino del logo; valor aproximado, confirmar con el logo) |
| `--color-primario-texto` | `#ffffff` | Sin cambio |
| `--color-error` / `--color-error-fondo` | `#a4161a` / `#fdecec` | Sin cambio |
| `--color-info` / `--color-info-fondo` | `#0b5132` / `#e6f4ec` | Sin cambio |
| `--color-foco` | `#b87d00` | Anillo de foco de 3 px. Ajustado en D1: `#f2a900` daba 2,01:1 sobre blanco; `#b87d00` da 3,52:1 (WCAG 1.4.11) |
| `--color-neutro-fondo` (nuevo, D3) | `#edf1f6` | Fondo de la insignia de estado neutra y del paso pendiente de la línea de estado (§4) |
| `--color-neutro-texto` (nuevo, D3) | `#27323f` | Texto de la insignia de estado neutra (§4) |
| `--color-borde-azul` (nuevo, D3) | `#c5daf2` | Borde del aviso informativo y de la tarjeta destacada del inicio (§4, §7.0) |
| `--color-borde-verde` (nuevo, D3) | `#bfe3cc` | Borde del mensaje de confirmación (§4) |

**Riesgo** (nuevos; siempre con ícono + texto):

| Nivel | Fondo | Texto/ícono | Ícono |
|---|---|---|---|
| Bajo | `--color-riesgo-bajo-fondo: #e3f4ea` | `--color-riesgo-bajo-texto: #14532d` | `check` |
| Medio | `--color-riesgo-medio-fondo: #fff1d6` | `--color-riesgo-medio-texto: #7a4b00` | `triangle-alert` |
| Alto | `--color-riesgo-alto-fondo: #fde7e7` | `--color-riesgo-alto-texto: #8e1b1b` | `octagon-alert` |

### 2.2 Espaciado, radios y sombras

| Variable | Valor | Nota |
|---|---|---|
| `--espacio-1` … `--espacio-5` | sin cambio (4, 8, 16, 24, 32 px) | |
| `--espacio-1-5` (nuevo) | `0.75rem` (12 px) | Relleno de celdas y botones |
| `--radio-control` (nuevo) | `0.625rem` (10 px) | Campos, botones, insignias |
| `--radio` | alias de `--radio-control` | Se conserva para no romper los módulos |
| `--radio-tarjeta` (nuevo) | `0.875rem` (14 px) | Tarjetas de Docente, Jefe y Psicólogo |
| `--radio-tarjeta-estudiante` (nuevo) | `1rem` (16 px) | Tarjetas del Estudiante |
| `--radio-pildora` (nuevo) | `999px` | Avatar, chips |
| `--sombra-1` (nuevo) | `0 1px 2px rgba(16,24,40,.06)` | Tarjetas en reposo |
| `--sombra-2` (nuevo) | `0 6px 16px rgba(16,24,40,.04)` | Elementos elevados |
| `--sombra-dialogo` (nuevo) | `0 6px 16px rgba(16,24,40,.18)` | Solo el diálogo de consentimiento |
| `--ancho-barra-lateral` (nuevo) | `16rem` (256 px) | |

### 2.3 Tipografía

- Fuente: **Plus Jakarta Sans** (pesos 400, 500, 600, 700, 800). `--fuente: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.
- Carga: preferir autoalojada (`@fontsource-variable/plus-jakarta-sans`) para no depender de un servicio externo. Si el agente propone otra forma (enlace a Google Fonts), debe justificarla en el plan.
- Escala:

| Rol | Tamaño | Peso | Uso |
|---|---|---|---|
| `h1` | 28 px (`1.75rem`), interlineado 1.2 | 800 | Título de pantalla |
| `h2` | 18 px (`1.125rem`) | 700 | Título de tarjeta/sección |
| Cuerpo | 15 px (`0.9375rem`), interlineado 1.5 | 400 | Texto base y campos |
| Pequeño | 14 px (`0.875rem`) | 500–600 | Tablas densas, botones, menú |
| Etiqueta | 12 px (`0.75rem`) | 600–700 | Encabezados de columna (mayúscula con `letter-spacing: .04em`), insignias |
| Cifra grande | 36 px (`2.25rem`) | 800 | Nota/asistencia (Estudiante) y totales (Informes) |

### 2.4 Movimiento

Transiciones de 150 ms como máximo en `background-color`, `color`, `border-color` y `box-shadow`. Se respeta el bloque `prefers-reduced-motion` ya existente.

---

## 3. Plantilla común (`componentes/plantilla.tsx` y su CSS)

### 3.1 Escritorio (≥ 64 rem)

Reemplaza el encabezado superior + navegación horizontal por una **barra lateral izquierda** única para los cuatro roles.

- Ancho `--ancho-barra-lateral`, fondo `--color-superficie`, borde derecho `1px solid --color-borde-suave`, relleno 24 px 16 px, altura completa (`min-height: 100vh`, fija mientras se desplaza el contenido).
- Parte superior: **logo** (ícono) + texto «DETECTA» (800, 18 px, `letter-spacing: .08em`, color `--color-marca`).
- Debajo: rótulo del rol en mayúsculas (12 px, 700, `letter-spacing: .1em`, `--color-texto-rotulo`) tomado de `NOMBRE_ROL`, y la lista de enlaces del rol (los que ya entrega `NavegacionRol`). Cada enlace: alto mínimo 44 px, relleno horizontal 14 px, radio `--radio-control`, 14 px/600, ícono de 20 px a la izquierda (gap 12 px). Hover: fondo `--color-primario-tinte` y texto `--color-primario`. Activo (`aria-current="page"`): fondo `--color-primario`, texto y ícono blancos.
- Parte inferior (separada por `border-top`): avatar circular de 40 px con **iniciales** del nombre del usuario (fondo `--color-avatar`, texto `--color-primario`, 14 px/700), nombre (14 px/700) y rol (12 px, `--color-texto-suave`); debajo, botón «Cerrar sesión» (secundario: borde `--color-primario`, fondo blanco, texto `--color-primario`, ícono `log-out`, ancho completo, 44 px).
- Contenido principal: a la derecha de la barra, relleno 40 px 48 px, `max-width` 1040 px (1000 px en pantallas con tabla de detalle), `gap` vertical de 20–24 px entre bloques.
- `h1`: encabezado de la pantalla; cuando exista texto de ayuda, va justo debajo (14 px, `--color-texto-suave`).

### 3.2 Pantallas pequeñas (< 64 rem)

La barra lateral no cabe. Conservar el comportamiento móvil actual con el nuevo aspecto: barra superior con ícono de marca + «DETECTA» + usuario + «Cerrar sesión», y el menú del rol como fila horizontal de enlaces (con ícono) debajo, como hoy. El agente decide la implementación exacta en el plan, pero **no puede dejar el menú inaccesible ni provocar desbordamiento horizontal a 360 px**.

### 3.3 Logo

Archivos entregados por Ivan en `front/src/activos/`:

- `logo-completo.png`: logo con birrete, lupa, «DETECTA» y «Sistema de alerta temprana». Fondo transparente. **Solo** en la pantalla de acceso (y, si se requiere, pantallas de activación).
- `logo-icono.png`: solo el ícono (D con birrete y lupa). En la barra lateral/superior junto al texto «DETECTA». Alto 40 px.

Ambas imágenes con `alt` descriptivo («Logo de DETECTA»). Usar la importación de Vite para que el empaquetado resuelva la ruta.

### 3.4 Íconos

Un único conjunto de íconos de trazo (estilo Lucide, `stroke-width: 2`, `currentColor`, `aria-hidden="true"`). Preferir un componente `Icono` propio con SVG en línea, sin añadir dependencia; si el agente propone `lucide-react`, debe justificarlo en el plan (tamaño, árbol de importaciones).

| Uso | Nombre Lucide |
|---|---|
| Inicio | `house` |
| Consulta académica | `book-open` |
| Mis solicitudes / Casos pendientes | `list` / `file-text` |
| Solicitar acompañamiento | `target` |
| Alertas emitidas | `bell` |
| Remisiones | `users` |
| Informes de riesgo | `chart-line` |
| Cerrar sesión | `log-out` |
| Riesgo medio / alto / bajo | `triangle-alert` / `octagon-alert` / `check` |
| Sincronización | `clock` |
| Confidencialidad | `lock` |
| Volver | `arrow-left` |
| Fila abrible | `chevron-right` |
| Exportar PDF | `download` |
| Enviar / emitir | `send` |
| Cerrar formulario | `x` |

Los íconos acompañan a un texto visible; cuando comunican estado, el texto es obligatorio.

---

## 4. Componentes compartidos (nuevos o modificados)

| Componente | Descripción |
|---|---|
| **Tarjeta** | Fondo `--color-superficie`, borde `1px --color-borde-suave`, radio `--radio-tarjeta` (`--radio-tarjeta-estudiante` en el Estudiante), `--sombra-1`. Relleno 24 px (cómoda) o sin relleno cuando contiene una tabla. |
| **Campo** (`campo.tsx`, `controles.module.css`) | Etiqueta 14 px/600 siempre visible; control de alto mínimo 44 px, borde `--color-borde`, radio `--radio-control`, fuente 15 px; ayuda debajo (13–14 px, `--color-texto-suave`). Error con ícono + texto (`--color-error`). |
| **Botón primario** | Fondo `--color-primario`, texto blanco, 700, alto mínimo 44 px, radio `--radio-control`, relleno horizontal 22 px, hover `--color-primario-hover`. Deshabilitado: mantener `cursor: not-allowed` y un color atenuado distinguible, sin perder legibilidad del texto. |
| **Botón secundario** | Fondo blanco, borde y texto `--color-primario`, 600. Variante compacta de tabla: alto 36 px, 13 px, relleno 14 px. |
| **Selección (radio/casilla)** | Opción en caja de 52–56 px de alto: borde `--color-borde` y, seleccionada, borde `--color-primario` de 2 px con fondo `--color-primario-tinte`. En las opciones de riesgo, canalización y dictamen se reparten el ancho de la fila. Casillas: caja de 20 px con radio 6 px. Mantener los `input` nativos (accesibilidad) estilizados, sin sustituirlos por `div`. |
| **Insignia de riesgo** (`InsigniaRiesgo`) | Pastilla de radio `--radio-control`, relleno 4 px 10 px, 12 px/700, ícono de 14 px + texto «Bajo/Medio/Alto» (de `NOMBRE_NIVEL_RIESGO`). Reemplaza el uso actual de `textoNivel()` donde se muestra un nivel. |
| **Insignia de estado** | Misma forma. Neutro (`#edf1f6` / `#27323f`) para Pendiente; tinte azul (`--color-primario-tinte` / `#08457f`) para En evaluación y Citado; verde (como riesgo Bajo) para En seguimiento y Atendida. Siempre con texto. |
| **Tabla** (`tabla.module.css`) | Se conserva la versión apilada en celular. En escritorio: contenedor con tarjeta (sin relleno, `overflow: hidden`), encabezado con fondo `#f8fafd`, 12 px/700 en mayúscula, `--color-texto-rotulo`; celdas con borde inferior `--color-borde-suave`. Variante **compacta**: relleno vertical 10 px (bandejas y listado del Docente). Variante **cómoda**: relleno 16 px. |
| **Fila abrible** (bandejas) | Toda la fila es área de clic y la fila muestra `chevron-right` al final. Mantener un enlace/botón real dentro de la fila (accesibilidad y teclado) y extender su área con la técnica de enlace estirado (`::after` posicionado sobre la fila). Hover de fila: `--color-primario-tinte`. |
| **Mensajes** (`mensaje-error.tsx`) | `MensajeError` y `MensajeInformativo` pasan a tarjeta con ícono: error (`triangle-alert`, fondo `--color-error-fondo`), confirmación (`check`, fondo verde de `--color-info-fondo`), informativo (`info`/`lock`, fondo `--color-primario-tinte`). Se conservan los roles `alert`/`status` actuales. |
| **Línea de estado del caso** (nuevo) | Fila horizontal en una tarjeta: pasos con círculo de 28 px (hecho = verde con `check`; actual = `--color-primario` con punto; pendiente = gris `#edf1f6`), unidos por un trazo de 2 px. Pasos y su significado en la sección 7.3. |
| **Cifra grande** (nuevo) | Número 36 px/800 con rótulo 14 px/700 y (opcional) definición 13 px debajo. |
| **Diálogo** (nuevo) | Ver sección 7.6. |

**Desviación aceptada (D3b):** Casillas y radios sueltos usan los controles nativos con accent-color (20 px) en lugar de una caja propia de 6 px de radio; decisión de Ivan en D3b por accesibilidad y teclado.

---

## 5. Alcance por rol y pantallas

La referencia visual de cada una es el mockup con el mismo `IU_*`. Las pantallas **sin mockup** reciben el mismo tratamiento mediante la plantilla y los componentes compartidos, sin diseño propio:

| Pantalla del front | ¿Tiene mockup? |
|---|---|
| `acceso/iniciar-sesion` | Sí |
| Inicio de cada rol (**nueva**) | Sí (Lote 6) |
| `acceso/solicitar-activacion`, `acceso/activar` | No: tarjeta centrada y campos como el inicio de sesión |
| `estudiante/consulta-academica` | Sí |
| `estudiante/solicitar-acompanamiento` | Sí |
| `estudiante/mis-solicitudes` | No: tarjetas/tabla cómoda con insignia de estado |
| `docente/consulta-curso` (selección de curso y periodo) | No: tarjeta de formulario como el filtro de periodo del Estudiante |
| `docente/listado-curso` + `formulario-alerta` | Sí |
| `docente/alertas-emitidas` | No: tabla compacta con insignia de riesgo |
| `jefe-departamento/bandeja-casos`, `detalle-caso`, `plan-nivelacion` | Sí |
| `psicologo/espacio-psicologo` (Remisiones) | Sí |
| `psicologo/expediente` (+ dictamen, resultado, consentimiento) | Sí |
| `iu-informes` (Jefe y Psicólogo) | Sí |

---

## 6. Densidad por rol

| Rol / pantalla | Densidad |
|---|---|
| Estudiante | **Cómoda**: tarjetas con relleno 24 px, cifras grandes, tono empático |
| Docente: listado del curso | **Compacta** (hasta 60 estudiantes, ER 3.4.1) |
| Docente: formulario de alerta | **Cómoda** |
| Jefe: bandeja | **Compacta** |
| Jefe: detalle y plan | **Cómoda** |
| Psicólogo: remisiones | **Compacta** |
| Psicólogo: expediente | **Cómoda** |
| Informes | **Cómoda** |

---

## 7. Cambios por pantalla

### 7.0 Pantalla de inicio por rol (NUEVA; ER 3.7 h) — mockups «Inicio» del Lote 6

Pantalla nueva, una por rol, con la misma plantilla. **Sin datos ni cifras**: solo accesos a pantallas existentes.

- **Menú:** «Inicio» pasa a ser la **primera** opción del menú de cada rol (ícono `house`), y es la opción activa en esta pantalla.
- **Ruta:** se agrega una ruta nueva `…/inicio` por rol. Las rutas existentes no cambian. Tras iniciar sesión, cada usuario llega a su inicio. El agente debe proponer en el plan cómo resolverlo con `ESPACIO_POR_ROL` y la redirección actual (las pruebas que dependan del destino inicial se actualizan y se informan).
- **Contenido:** `h1` «Hola, {primer nombre}», ayuda debajo y una cuadrícula de tarjetas (`repeat(auto-fit, minmax(380px, 1fr))`, 1 columna en celular, separación 16 px).
- **Tarjeta de función:** es un enlace (toda la tarjeta es área de clic). Relleno 24 px, radio `--radio-tarjeta` (`--radio-tarjeta-estudiante` en el Estudiante), `--sombra-1`; ícono de 24 px dentro de un recuadro de 48 px (fondo `--color-primario-tinte`, texto `--color-primario`, radio 12 px); nombre 18 px/700; descripción 14 px/`--color-texto-suave`; `chevron-right` a la derecha. Sin botón primario.
- **Estudiante:** la tarjeta «Solicitar acompañamiento» lleva borde de 2 px `#c5daf2` y una insignia «Confidencial» con ícono `lock` (fondo `--color-primario-tinte`, texto `#08457f`). Es lo que permite que el estudiante identifique el canal confidencial sin explicación previa.
- **Funciones por rol:** Estudiante: Consulta académica, Mis solicitudes, Solicitar acompañamiento. Docente: Consulta de curso, Alertas emitidas. Jefe: Casos pendientes, Informes de riesgo. Psicólogo: Remisiones, Informes de riesgo. Las tarjetas se derivan de los enlaces que ya declara cada rol, para no duplicar la lista.
- Textos en la sección 8.

### 7.1 Inicio de sesión (`acceso/iniciar-sesion`) — mockup «Iniciar sesión»

- Sin barra lateral. Contenido centrado vertical y horizontalmente, ancho máximo 26 rem (`--ancho-formulario`).
- Arriba: `logo-completo.png` (alto ≈ 84 px, centrado).
- Tarjeta con relleno 32 px: `h1` «Iniciar sesión», campos «Correo electrónico» y «Contraseña», botón primario **de ancho completo**, y debajo, centrado, el enlace «Solicitar enlace de acceso».
- Mensajes de error/info del acceso con el componente de mensajes de la sección 4.
- Texto nuevo provisional: ayuda bajo el título (sección 8).

### 7.2 Estudiante

**Consulta académica (`IU_ConsultaAcademica`)**

- Barra lateral con tres enlaces (Consulta académica, Mis solicitudes, Solicitar acompañamiento).
- Título «Consulta académica» y ayuda bajo el título (texto nuevo).
- Tarjeta de filtro: «Periodo académico» (200–260 px de ancho) y botón «Consultar» alineado con el campo.
- «Mis asignaturas · {periodo}» (h2). Las asignaturas pasan de tabla a **cuadrícula de tarjetas** de 2 columnas (1 columna en celular). Cada tarjeta: nombre (18 px/700), «Última sincronización: {fecha}» (12 px, `--color-texto-rotulo`), y dos **cifras grandes**: nota (con rótulo «Nota acumulada» — texto nuevo; el rótulo real del front es «Nota») y asistencia en % con **barra de progreso** (8 px de alto, pista `--color-avatar`, relleno `--color-primario`).
- Cuando falte un dato se mantiene «Información no disponible» (ER 3.3.1) en lugar de la cifra, sin barra.
- Alertas del estudiante: bloque de aviso por alerta, con fondo según nivel (usar los pares de riesgo), ícono, título «Riesgo {nivel} · {asignatura}» y el texto de apoyo. El enlace «Solicitar acompañamiento» solo aparece donde el mockup lo muestra (aviso de riesgo). **No se inventan alertas**: solo se muestran las que entrega la API.

**Solicitud de acompañamiento (`IU_SolicitudAcompanamiento`)**

- Formulario en tarjeta de 860 px como máximo: «Tipo de apoyo» como dos opciones lado a lado (Académico / Psicosocial) sin valor por defecto; aviso de confidencialidad con ícono `lock` (texto nuevo, sección 8); «Motivo» (área de texto), «Disponibilidad horaria (opcional)»; botón primario «Enviar solicitud» y secundario «Cancelar».
- La confirmación posterior al envío usa el mensaje de confirmación de la sección 4.

### 7.3 Docente

**Listado del curso (`IU_AlertasTempranas`)**

- Título «Consulta de curso»; debajo, curso · código · periodo.
- Fila de dos tarjetas pequeñas: **estado de sincronización** («Última sincronización: {fecha y hora}» con ícono `clock`; sin afirmar que esté actualizada; «Información no disponible» si nunca se sincronizó, ER 3.3.5) y **cantidad de estudiantes** (se calcula del listado).
- Tabla **compacta**: Estudiante / Nota / Asistencia / (acción). El botón «Emitir alerta» (secundario compacto con ícono `bell`, 36 px) queda en la propia fila, a la derecha.

**Formulario de alerta**

- Se abre **sobre el listado** (como hoy), en tarjeta con borde de 2 px `--color-primario`, título «Emitir alerta» y botón de cierre (`x`, 44 px) arriba a la derecha. La fila del estudiante elegido se resalta con `--color-primario-tinte` y el resto de filas se atenúa (opacidad ≈ .55) mientras el formulario está abierto.
- Bloque de solo lectura con Estudiante / Curso / Nota / Asistencia (fondo `--color-fondo`, radio `--radio-control`).
- «Nivel de riesgo»: tres opciones repartidas en fila (Bajo, Medio, Alto), **sin valor por defecto**.
- «Justificación» con contador «n / 2000» alineado a la derecha.
- Botones: «Emitir alerta» (primario, ícono `send`) y «Cancelar».
- Se conservan todos los mensajes y la conciliación existentes; la confirmación «Alerta emitida y remitida al Jefe de Departamento» usa el mensaje de confirmación.

### 7.4 Jefe de Departamento

**Casos pendientes (`IU_GestionCasos`)**

- Solo la tabla compacta, **sin tarjetas de resumen**: Estudiante / Fecha / Origen / Nivel de riesgo (insignia) / flecha `chevron-right`. Fila completa abrible.
- Ayuda bajo el título (texto nuevo).

**Detalle del caso**

- Enlace «Volver a casos pendientes» (ícono `arrow-left`, 44 px) sobre el título «Detalle del caso». **Texto nuevo.**
- **Línea de estado** con tres pasos: «Caso recibido» → «Canalización» → «Plan de nivelación» (textos nuevos). Reglas: caso sin ruta → «Caso recibido» hecho, «Canalización» actual. Ruta psicológica canalizada → los dos primeros hechos y se omite el tercer paso. Ruta académica canalizada sin plan → «Plan de nivelación» actual. Con plan registrado → los tres hechos.
- Tarjeta «Datos del caso» en cuadrícula de dos columnas de pares rótulo-valor (Estudiante, Fecha, Origen, Nivel de riesgo como insignia, Curso, Periodo académico, Nota, Asistencia) y «Justificación» a ancho completo. En solicitudes se muestran los campos propios (tipo de apoyo, motivo, disponibilidad) con los rótulos actuales.
- Tarjeta «Antecedentes académicos» con tabla (Curso / Periodo académico / Nota / Asistencia); si no hay, «Información no disponible».
- Tarjeta «Canalizar caso»: «Ruta de atención» con dos opciones (Ruta académica / Ruta psicológica) **sin valor por defecto**, y botón «Canalizar caso» deshabilitado hasta elegir; junto al botón, ayuda «Selecciona una ruta para continuar.» (texto nuevo).

**Plan de nivelación (`IU_PlanNivelacion`)**

- Tras canalizar a la ruta académica, el bloque aparece en la misma vista, debajo de una confirmación «Caso canalizado a la ruta académica» (texto existente) y de una tarjeta de una línea con «Ruta de atención: Ruta académica».
- Formulario: «Nombre del tutor» y «Código del tutor» en dos columnas, «Cronograma (opcional)» (área de texto), «Cursos del plan» (casillas de 44 px) y «Registrar plan» (primario).
- Plan registrado/finalizado: mostrar los datos en pares rótulo-valor con la insignia de estado «Activo/Finalizado» y el botón «Finalizar plan» como secundario.

### 7.5 Psicólogo

**Remisiones (`IU_Expedientes`)**

- Dos secciones con h2: «Sin asignar» y «Asignadas a mí», cada una con tabla **compacta**: Estudiante / Fecha / Estado (insignia de estado) / enlace «Ver expediente» con `chevron-right`. Fila completa abrible.
- Ayuda bajo el título (texto nuevo).

**Expediente (`IU_Expedientes`, `IU_EvaluacionPertinencia`)**

- «Volver a remisiones» sobre el título «Expediente de atención psicológica».
- Tarjeta de datos en cuadrícula de dos columnas: Estudiante, Fecha, Estado, Ruta de atención, Presenta riesgo crítico, Nivel de riesgo (insignia), Psicólogo asignado, Consentimiento informado confirmado, Origen y, según el origen, los campos propios (Tipo de apoyo, Motivo, Disponibilidad horaria / Curso, Periodo, Justificación, Nota, Asistencia).
- «Antecedentes académicos»: tabla con las columnas actuales (incluida «Última sincronización»).
- «Evaluar pertinencia»: tres opciones repartidas (Aprobar, Archivar, Reorientar) **sin valor por defecto**, «Justificación» obligatoria y botón primario «Evaluar pertinencia», deshabilitado hasta elegir una opción (comportamiento actual).

**Resultado de asesoría y consentimiento (`IU_ResultadoAsesoria`, `IU_ConfirmacionConsentimiento`)**

- «Citas»: tarjeta por cita con fecha y hora, modalidad y estado.
- «Resultado de asesoría» (rótulo actual «Registrar resultado»): «Tipo de asesoría» y «Asistencia» en dos columnas, «Observaciones», «Acuerdos», casillas «Requiere seguimiento» y «Presenta riesgo crítico», botón primario «Registrar resultado».
- Si falta el consentimiento: aviso con ícono `lock` y el texto existente «La atención requiere el consentimiento informado del acudiente».

### 7.6 Confirmación de consentimiento (cambio de comportamiento)

Hoy es un formulario dentro de la página (`expediente.tsx`, componente de confirmación). Debe pasar a **diálogo modal** sobre la pantalla de resultado, como define la Vista de Procesos (`IU_ConfirmacionConsentimiento` sobre `IU_ResultadoAsesoria`).

- Contenido: título «Confirmar consentimiento», texto «La atención requiere el consentimiento informado del acudiente», casilla «¿El acudiente otorgó el consentimiento informado?», botones «Confirmar consentimiento» (primario, deshabilitado hasta marcar la casilla) y «Cancelar».
- Capa de fondo `rgba(27,36,48,.45)`; diálogo de 480 px, relleno 28 px, radio `--radio-tarjeta`, `--sombra-dialogo`.
- Accesibilidad: elemento `dialog` nativo con `showModal()` o `role="dialog"` + `aria-modal="true"` + `aria-labelledby`; el foco entra al diálogo, queda atrapado, `Esc` cierra, y al cerrar vuelve al elemento que lo abrió.
- Es el **único diálogo** del sistema: el resto de acciones se confirman con un mensaje posterior, no con una ventana previa.
- Se conservan el flujo, los errores y la lógica actuales (`confirmarConsentimiento`, recarga del caso).

### 7.7 Informes de riesgo (`IU_Informes`, componente `iu-informes.tsx`)

- Título «Informes de riesgo» y ayuda (texto nuevo).
- Tarjeta de formulario: «Periodo académico» (con su ayuda «Por ejemplo: 2026-2»), «Programa» (solo Psicólogo), «Código del curso» y «Generar informe». **Todos los campos con la misma estructura** (etiqueta, control, línea de ayuda de altura fija) y alineados por el borde superior; el botón alineado con los controles. (Corrección de alineación ya hecha en el mockup.)
- Informe generado: tarjeta con Curso / Periodo / Fecha; tres **cifras grandes** (Total de alertas, Total de casos, Total de planes), cada una con la definición del backend debajo; resumen; aviso con `lock` («Este informe solo contiene datos agregados: no incluye nombres, motivos ni contenido de los expedientes.»); botón secundario «Exportar PDF» (ícono `download`).
- «Generando el informe…» y el mensaje de «sin datos» se mantienen con el componente de mensajes.

---

## 8. Textos nuevos provisionales (a registrar en `textos.ts`/`etiquetas.ts` con la marca habitual)

Solo estos textos son nuevos. Todos son provisionales y se revisan en la revisión de usabilidad (F5c).

| Dónde | Texto |
|---|---|
| Inicio de sesión, ayuda bajo el título | «Ingresa con tu correo institucional.» |
| Consulta académica, ayuda | «Aquí puedes ver cómo vas en tus asignaturas.» |
| Consulta académica, rótulo de cifra | «Nota acumulada» |
| Consulta académica, título de listado | «Mis asignaturas · {periodo}» |
| Aviso de riesgo medio del Estudiante | «Tu desempeño en esta asignatura puede mejorar con apoyo a tiempo. Si lo deseas, puedes solicitar acompañamiento.» |
| Solicitud, ayuda | «Cuéntanos qué necesitas; te responderemos con respeto y confidencialidad.» |
| Solicitud, aviso de confidencialidad | «Las solicitudes académicas las atiende el Programa. Las psicosociales solo las verá el área de Psicología; el Jefe de Departamento no tendrá acceso a ellas.» |
| Solicitud, confirmación | «Tu solicitud fue recibida. Te avisaremos cuando sea atendida.» |
| Casos pendientes, ayuda | «Selecciona un caso para ver su detalle y canalizarlo.» |
| Detalle del caso, volver | «Volver a casos pendientes» |
| Línea de estado | «Caso recibido», «Canalización», «Plan de nivelación» |
| Canalización, ayuda del botón deshabilitado | «Selecciona una ruta para continuar.» |
| Remisiones, ayuda | «Casos remitidos a psicología.» |
| Remisiones, volver | «Volver a remisiones» |
| Informes, ayuda | «Totales por asignatura y periodo, sin datos personales.» |
| Docente, listado | «{n} estudiantes» |
| Inicio, saludo | «Hola, {primer nombre}» |
| Inicio, ayuda | «Estas son las funciones disponibles para tu rol y para qué sirve cada una.» |
| Inicio, insignia | «Confidencial» |
| Inicio, Estudiante · Consulta académica | «Revisa tus notas, tu asistencia y tus alertas por periodo.» |
| Inicio, Estudiante · Mis solicitudes | «Consulta el estado de las solicitudes de acompañamiento que has enviado.» |
| Inicio, Estudiante · Solicitar acompañamiento | «Pide apoyo académico o psicosocial. Tu solicitud se trata con confidencialidad.» (**confirmar con Ivan**: la promesa de confidencialidad debe ser cierta también para las solicitudes académicas) |
| Inicio, Docente · Consulta de curso | «Revisa las notas y la asistencia de tu curso y emite alertas tempranas.» |
| Inicio, Docente · Alertas emitidas | «Consulta las alertas que has emitido en el periodo.» |
| Inicio, Jefe · Casos pendientes | «Revisa los casos recibidos y canalízalos a la ruta académica o psicológica.» |
| Inicio, Jefe y Psicólogo · Informes de riesgo | «Genera informes con totales por asignatura y periodo, sin datos personales.» |
| Inicio, Psicólogo · Remisiones | «Atiende los casos remitidos a psicología y consulta sus expedientes.» |

**Antes de implementar los textos del Estudiante y de la Solicitud**, el agente debe confirmar con Ivan si se aceptan, porque el estudiante es el usuario más sensible (ER 1.3.4: lenguaje empático, no alarmista y no clínico).

No son nuevos (ya están en el front): los rótulos de columnas, «Información no disponible», «Complete el nivel de riesgo y la justificación», «Alerta emitida y remitida al Jefe de Departamento», «Caso canalizado a la ruta académica», «Caso remitido a psicología», «La atención requiere el consentimiento informado del acudiente».

---

## 9. Forma de trabajo con el agente

1. **Plan primero.** El agente lee esta especificación y el front, y entrega un plan **sin modificar archivos**: archivos a tocar por fase, componentes nuevos, riesgos para las pruebas y decisiones abiertas (fuente, íconos, estrategia móvil de la plantilla).
2. **Fases, con auditoría y aprobación de Ivan entre cada una:**
   - **D1** Tokens, tipografía y base global (`base.css`, carga de fuente).
   - **D2** Plantilla con barra lateral, logo, íconos y comportamiento móvil.
   - **D3** Componentes compartidos: insignias, línea de estado, cifra grande, tarjeta de función, enlace de regreso y mensajes.
   - **D3b** Controles compartidos: botón primario y secundario, campos (con el error en línea) y selección en caja.
   - La tabla compacta y cómoda, la fila abrible y la tarjeta se implementan con su primera pantalla de uso (D4 a D7), no en D3 (decisión de Ivan en D3).
   - **D4** Acceso, **inicio de los cuatro roles** y Estudiante.
   - **D5** Docente.
   - **D6** Jefe de Departamento.
   - **D7** Psicólogo (incluye el diálogo de consentimiento) e Informes.
3. **Prioridad previa:** la corrección del formulario «Programar primera cita» definida en el otro chat (F5b) va **antes** de D1; esta especificación no la reemplaza.
4. Cada fase termina con: `npm test` y comprobación de tipos en verde; lista de archivos modificados; capturas a 1280 px y a 360 px de las pantallas tocadas; y una nota de cualquier desviación respecto a esta especificación.

## 10. Criterios de aceptación globales

- Ningún texto cambia fuera de la sección 8; ninguna ruta ni `IU_*` cambia.
- Contraste AA en texto y bordes de controles; foco visible en todos los controles; navegación completa por teclado.
- Sin desbordamiento horizontal a 360 px en ninguna pantalla.
- El riesgo se distingue por ícono y texto además del color.
- Un solo botón primario por pantalla (en el diálogo, el primario del diálogo).
- Todas las pantallas de los cuatro roles usan la misma plantilla y los mismos componentes.
- No se agregan datos de ejemplo al producto: los mockups usan ejemplos, el front solo muestra lo que entrega la API.
