# DETECTA — Plan de implementación del frontend (F0 a F5)

Plan que continúa el `plan-backend.md` (B0 a B9, cerrado y fusionado en `main`). Cada fase tiene un criterio de cierre que se audita contra los diagramas, el ER y el Manual. Donde el documento indica «verificar», el dato debe comprobarse en la fuente indicada antes de implementarse, y no darse por supuesto.

## Punto de partida

- El backend está completo y su contrato es estable: las rutas, los códigos de respuesta y los textos ya están aprobados y registrados en `docs/00-linea-base.md`. El frontend no se bloquea por el backend y **no lo modifica**. Si una pantalla necesita algo que el backend no expone, se plantea como decisión abierta y no se resuelve por cuenta propia.
- El Manual (4.1.1.1) define el frontend como una aplicación de una sola página en React y TypeScript, organizada por rol, donde cada pantalla corresponde a una interfaz de usuario de la Vista de Procesos y solo invoca al controlador de su caso de uso. Ocultar opciones según el rol es una ayuda de usabilidad; la autorización real está en el backend.
- Este plan detalla en seis fases (F0 a F5) lo que el `plan-backend.md` anticipaba como F0 a F2, porque cada rol es una unidad auditable por separado.

## Método de cada fase

El mismo del backend:

1. Ivan escribe el prompt para el agente de codificación.
2. El agente presenta su plan antes de ejecutar y espera aprobación.
3. Aprobado el plan, el agente trabaja en una rama propia (`fase/fN-...`) creada desde `main`.
4. Al terminar, entrega el informe de cierre sin declarar la fase cerrada y sin hacer push; Ivan lo audita con apoyo de Claude.
5. La fase se cierra solo cuando la auditoría confirma el cumplimiento; después se fusiona con merge commit, sin squash, y no se borran las ramas.

## Reglas de trabajo del frontend

- No se inventan textos de pantalla. Solo se usan los transcritos de los diagramas, del ER y del Manual, o los ya registrados en la línea base. Todo texto no definido se plantea como pregunta.
- No se agregan dependencias sin proponerlas con su razón. La pila es ligera por defecto, para limitar el tiempo y el costo de cada fase.
- El contrato de la API se toma de los controladores y de `back/README`, y se escribe como cliente tipado en `servicios-api`.
- Ningún secreto en el código ni en el repositorio. No se persiste contenido confidencial (motivos, expedientes, asesorías) en `localStorage`, `sessionStorage` ni en cachés del navegador.
- Cada fase cierra con build, lint, format, typecheck y pruebas en verde.
- Los archivos se agregan a Git de forma explícita (nunca `git add -A`) y `.claude/` no entra en ningún commit.

## Convenciones del front

Vigentes desde F1b; el código nuevo de F3, F4 y F5 nace con ellas, sin una pasada de corrección posterior.

- **Reutilización primero.** Antes de escribir un componente, hook o función se busca en `componentes/` y `servicios-api/`: `pedir` y `errorDeRespuesta` (cliente), `limites`, `etiquetas`, `formato` (es-CO), `buscarNueva` y `enviarConConciliacion` (conciliación del envío), `useEnvio`, `useConsulta`, `CampoTexto`, `GrupoOpciones`, `FormularioPeriodo` y `.seccion` de `controles.module.css`. Se usa; no se copia.
- **Compartido nuevo con TDD.** Si hace falta un módulo compartido nuevo, primero la prueba en rojo y luego el código mínimo, dentro de esas dos carpetas y sin carpetas nuevas.
- **Forma del código.** Cláusulas de guarda y retorno anticipado (máximo 2 niveles de anidación), sin `else` tras `return`, tablas de correspondencia en lugar de cadenas `if/else`, funciones de una sola responsabilidad y de menos de 80 líneas, máximo 3 parámetros (objeto de opciones si hacen falta más), sin código muerto, sin comentarios que repitan el código y sin abstracciones de un solo uso. Los comentarios que se conservan citan el requisito, el diagrama o el caso de uso, o explican el porqué.
- **Plan e informe.** El plan de cada fase lleva una sección «Reutilización» (módulos existentes que usa y compartidos nuevos con su prueba). Antes del informe se revisan los archivos tocados con oxlint y una configuración temporal `-c` con los valores aprobados, sin modificar `.oxlintrc.json`; el informe da una línea con el resultado y solo los totales de las verificaciones.

## Fases

| Fase | Qué se construye | Carpetas | Cierre |
|---|---|---|---|
| F0 | Esqueleto de React con TypeScript estricto, estructura por rol, cliente HTTP con cookies y manejo uniforme de errores, diseño base y accesibilidad base, rutas protegidas por rol (solo como ayuda de usabilidad), flujo de sesión: inicio y cierre de sesión, solicitud y uso del enlace de activación, consulta de la sesión vigente | `front`: `paginas/{acceso, estudiante, docente, jefe-departamento, psicologo}`, `componentes`, `servicios-api` (diagrama de paquetes, Manual 4.1.2) | Compila, pasa lint y typecheck. Un usuario de cada rol inicia sesión, ve su espacio vacío y es redirigido fuera de las rutas de otro rol. Los errores 401, 403, 409, 429 (con `Retry-After`), 503 y 500 se muestran de forma uniforme |
| F1 | Estudiante: consulta de su información académica y de sus alertas y solicitudes (CUD01), y solicitud de acompañamiento voluntario (CUD02) | `paginas/estudiante` | El estudiante consulta lo suyo y radica una solicitud con su código de rastreo; no ve información de otros. Funciona en pantalla de celular |
| F2 | Docente: consulta de notas y asistencia de sus estudiantes con el estado de la sincronización (ER 3.3.5), emisión de alertas y consulta de las emitidas con su estado de atención (CUD01 y CUD03) | `paginas/docente` | El docente ve solo sus cursos; la fecha de la última sincronización y la marca de información no disponible son inequívocas; emite una alerta completa |
| F3 | Jefe de departamento de programa: bandeja de casos del programa, detalle y canalización (CUD04), plan de nivelación (CUD05) e informes de riesgo (CUD10) | `paginas/jefe-departamento` | El caso se canaliza a su ruta; el plan se registra y se finaliza; el informe se genera y se exporta en PDF; el Jefe nunca ve solicitudes psicosociales |
| F4 | Psicólogo: expedientes y bandeja de remisiones (CUD06), evaluación de pertinencia (CUD07), asesorías, citas, seguimiento y cierre (CUD08), consentimiento informado de menores (CUD09) e informes (CUD10) | `paginas/psicologo` | Caso de riesgo de punta a punta, incluido el menor de edad, sin que la interfaz permita saltar el consentimiento |
| F5 | Cierre: revisión de usabilidad y accesibilidad (ER 3.3), pruebas de extremo a extremo de los flujos principales, compilación de producción, despliegue local reproducible junto al backend, instructivo de instalación y evidencias para el Manual | todo `front` | Los cuatro roles recorren su flujo principal sobre el despliegue local. Capturas y evidencias listas para el Manual |

## Detalle por fase

### F0. Esqueleto y sesión

- **Sesión:** el backend entrega el token en una cookie `HttpOnly` con `SameSite=Strict`. El frontend nunca lee ni guarda el token. Por `SameSite=Strict`, la aplicación y la API deben servirse desde el mismo sitio, y en desarrollo se resuelve con un proxy; el CORS del backend admite solo el origen exacto y los métodos GET y POST (verificar en `back/README`).
- **Errores uniformes:** 401 lleva al inicio de sesión; 403 muestra falta de permiso; 409, el mensaje del backend; 429, «Demasiados intentos. Intente de nuevo más tarde.» con espera según `Retry-After`; 503 y 500, el mensaje de la ruta o uno genérico. Los textos propios de cada ruta vienen de la línea base.
- **Recuperación de contraseña:** la define la decisión D6 de la línea base: el enlace de activación sirve para todas las cuentas y para recuperar la contraseña, con la misma ruta `solicitar-activacion`. No requiere pantalla aparte. El enlace que envía el backend apunta a `/activar#token=…`; el frontend debe tener esa ruta, leer el token del fragmento y enviarlo en el cuerpo de la solicitud.
- **Fuera de F0:** pantallas de negocio.

### F1. Estudiante

- **CUD01:** notas, asistencia, alertas emitidas sobre el estudiante y estado de sus solicitudes. El estado de la solicitud es derivado del caso (D27). El periodo académico es el filtro de la consulta de registros y de alertas: obligatorio y de texto libre (hasta 20 caracteres).
- **CUD02:** la solicitud lleva tipo de apoyo, motivo y disponibilidad horaria opcional, sin periodo (R02, Manual CUD02, sd_CUD02 y `POST /solicitudes`); el código de rastreo es el identificador del origen (D28). El aviso sobre quién ve la solicitud y el tratamiento de la solicitud cuando la base no está disponible y del doble envío se toman de R02 y de sd_CUD02 (verificar).
- **ER:** el reporte confidencial se confirma sin exponer quién lo hizo (3.3.3); la interfaz debe reflejar que el acompañamiento es asesoría educativa y no intervención clínica (1.3.4); uso principal desde celular (1.3.3).
- **Verificar en la línea base (§8):** el comportamiento para un estudiante sin registros académicos (D21).

### F2. Docente

- **Vista de sincronización (ER 3.3.5):** debe mostrar con claridad cuándo fue la última sincronización y si la información está actualizada, para que el docente no confunda un dato desactualizado con uno inexistente. La información no disponible se marca explícitamente (ER 3.3.1).
- **CUD03:** nivel de riesgo (bajo, medio o alto), descripción y registro académico que sustenta la alerta. El docente ve solo las alertas que emitió y el estado de atención; nunca ve motivos ni contenido confidencial (D18, D19).
- **ER:** uso principal desde computador de escritorio (3.3.4).

### F3. Jefe de departamento de programa

- **Visibilidad (D18):** ve el motivo y la disponibilidad de una solicitud académica sin canalizar o canalizada a la ruta académica; deja de verlo al canalizarla a psicología; las solicitudes psicosociales no aparecen nunca.
- **CUD04:** bandeja por programa, detalle del caso (origen, nivel, justificación, antecedentes) y canalización a ruta académica o psicológica. Un programa sin Jefe se atiende por bandeja de programa.
- **CUD05:** tutor, cursos del estudiante con registro académico (lista no vacía) y cronograma opcional. Textos transcritos: «Faltan los datos del estudiante tutor» y «Plan de nivelación registrado»; finalización del plan; los casos de la ruta académica quedan en nivelación y los planes se cuentan aparte (D29).
- **CUD10:** periodo y asignatura; el Jefe no envía programa. Textos transcritos: «No hay datos para el periodo seleccionado» (respuesta 200 con mensaje, sin informe) y «Error al generar el informe». El PDF muestra las definiciones de los totales. El Jefe solo exporta informes de su programa.

### F4. Psicólogo

- **Visibilidad (D19):** las remisiones sin asignar las ven todos los psicólogos; una vez asignada, solo el psicólogo asignado.
- **CUD07:** aprobar, archivar o reorientar con justificación. **CUD08:** resultado de la asesoría, citas, seguimiento, reprogramación (fecha y modalidad) y cierre. **CUD09 y regla R06:** en menores de edad, ningún avance sin consentimiento informado registrado; la interfaz debe impedirlo y explicarlo.
- **CUD10:** el Psicólogo indica el programa del informe (obligatorio) y puede exportar cualquiera.
- **Criterio de diseño:** es la fase de más riesgo por la confidencialidad y el consentimiento; sus pantallas no muestran contenido a quien no corresponde ni lo conservan en el navegador.

### F5. Cierre

- **Usabilidad y accesibilidad:** ER 3.3 (efectividad, eficiencia, satisfacción, accesibilidad y facilidad de uso); la revisión de la pantalla principal de cada rol y la prueba de tareas del ER 3.7 h se preparan aquí.
- **Pruebas:** componentes con pruebas unitarias a lo largo de las fases; de extremo a extremo solo los flujos principales de cada rol, para limitar el costo.
- **Despliegue local reproducible:** compilación de producción servida junto al backend bajo el mismo sitio, instructivo de instalación y evidencias para el Manual.
- **Documentación:** actualización de los diagramas (clases v3 a v4 y secuencias) con la lista de diferencias de la §7 de la línea base.
- Las pruebas de caja negra y de usabilidad con usuarios pertenecen a la fase de Transición y se planifican aparte.

## Por qué este orden

Primero lo común (esqueleto y sesión), porque todas las pantallas dependen de él. Luego los roles que capturan los datos (estudiante y docente), después la gestión (Jefe) y al final el Psicólogo, que concentra la confidencialidad y el consentimiento. F4 es la fase de más riesgo, y F3 la de más reglas de visibilidad. El cierre agrupa lo transversal y la evidencia.

## Decisiones abiertas

| Tema | Cuándo se resuelve |
|---|---|
| Pila de librerías: candidatas Vite, React Router, cliente HTTP propio, Vitest con Testing Library, Playwright solo al final; formularios y estilos a proponer con justificación | Plan de F0 |
| Diseño de interfaz: si no existen bocetos, F0 define un sistema de diseño mínimo y cada fase presenta bocetos de baja fidelidad en su plan | Antes de F0 |
| «Recuperación de contraseña»: resuelta por D6 (el enlace de activación también la cubre; misma ruta `solicitar-activacion`) | Resuelta |
| Máximo de reprogramaciones de una cita y tiempo máximo de canalización | F4 y F3, tras verificar la línea base |
| Aviso al estudiante al canalizar su caso: no existe (D8, sin implementar) | No se construye |
| Alta de Jefes y Psicólogos: no hay pantalla; los carga el responsable del despliegue con el script de datos iniciales (ER 3.1, Tabla 2; Manual 4.1.1.8) | Resuelta |
| Cómo se sirve el frontend en el despliegue (mismo sitio que la API, por `SameSite=Strict`) | F5 |

## Después del frontend

- Cierre del proyecto: actualización de diagramas v3 a v4, instructivo de instalación y evidencias para el Manual.
- Pruebas de caja negra y de usabilidad (fase de Transición), planificadas aparte.
