# DETECTA

Sistema web de alerta temprana y orientación académica para prevenir la deserción estudiantil (Universidad de Cartagena, proyecto de Ingeniería de Software, metodología RUP).

El análisis y el diseño están en [`docs/`](docs/). Las reglas de trabajo en este repositorio están en [`CLAUDE.md`](CLAUDE.md), y las fases de implementación en [`docs/plan-backend.md`](docs/plan-backend.md).

## Estructura

```
detecta/
├── back/                 Backend: NestJS + TypeScript (modo estricto)
│   └── src/
│       ├── controladores/
│       ├── aplicacion/   contratos/ y servicios/
│       ├── dominio/      entidades/ y repositorios/
│       ├── persistencia/ migraciones/
│       └── integracion/
├── front/                Frontend: React + TypeScript (se construye en la fase F0)
├── docker/postgres/      Aprovisionamiento de bases y usuarios
├── docs/                 Diagramas, línea base, plan y referencias (ER, Manual)
└── docker-compose.yml    PostgreSQL 18
```

La estructura sigue el diagrama de paquetes ([`docs/diagramas/paquetes.png`](docs/diagramas/paquetes.png)).

## Requisitos

- Node.js 26 o superior (probado con 26.13.1) y npm 11
- Docker con Docker Compose

## Puesta en marcha (desarrollo local)

1. **Variables de entorno.** Hay dos archivos `.env`, ninguno se versiona (ER 3.6.2):
   - `/.env`, a partir de [`/.env.example`](.env.example): contraseña del superusuario de PostgreSQL (la usa Docker Compose) y contraseñas de los usuarios `detecta_app` e `institucional_lector`.
   - `back/.env`, a partir de [`back/.env.example`](back/.env.example): conexión del backend a las dos bases. Las contraseñas deben coincidir con las de `/.env`.

2. **PostgreSQL.**

   ```bash
   docker compose up -d
   ```

3. **Bases y usuarios.** Crea la base `institucional_demo` y los usuarios de la aplicación si no existen. Se puede ejecutar varias veces sin duplicar nada y no borra datos.

   ```bash
   cd back
   npm ci
   npm run bd:crear
   ```

   | Base | Usuario | Permisos |
   |---|---|---|
   | `detecta` | `detecta_migrador` (crea las tablas) y `detecta_app` | `detecta_app` solo tiene `SELECT`, `INSERT` y `UPDATE`, nunca `DELETE` ni `TRUNCATE` (ER 3.7 c) |
   | `detecta_pruebas` | `detecta_migrador` (dueño) y `detecta_app` | El migrador crea las tablas; `detecta_app` solo tiene `SELECT`, `INSERT` y `UPDATE`, nunca `DELETE` ni `TRUNCATE` (ER 3.7 c) |
   | `institucional_demo` | `institucional_lector` | Conexión y uso del esquema `public`, sesiones de solo lectura. La vista institucional se crea en B4 |

   El superusuario `detecta_user` solo se usa para administrar y `detecta_migrador` solo para migraciones; la aplicación usa `detecta_app`.

   Después, aplica las migraciones (ver la sección **Migraciones**):

   ```bash
   cd back
   npm run build
   npm run bd:migrar
   ```

4. **Datos iniciales.** Programas, cuentas y cursos que no llegan por sincronización: docentes, jefes de departamento con su programa, psicólogos, y los cursos con su docente (asignación docente–curso). Los cursos deben existir antes de sincronizar. Copia [`back/datos-iniciales.ejemplo.json`](back/datos-iniciales.ejemplo.json) a `back/datos-iniciales.json` (fuera de git: contiene datos personales, Ley 1581) y complétalo. El script es idempotente por correo: no duplica ni modifica cuentas existentes. Por cada cuenta nueva imprime **una sola vez** su enlace de activación en la terminal.

   ```bash
   cd back
   npm run build
   npm run datos:iniciales -- datos-iniciales.json
   npm run datos:iniciales -- --enlace correo@ejemplo.edu.co   # enlace nuevo para una cuenta existente
   ```

5. **Base institucional de demostración.** Carga `institucional_demo` desde [`docker/postgres/institucional_demo.csv`](docker/postgres/institucional_demo.csv) (datos ficticios). Vacía y recarga la tabla en cada ejecución, y se niega a correr si `BD_INSTITUCIONAL_NOMBRE` no es `institucional_demo`.

   ```bash
   cd back
   npm run bd:institucional
   ```

6. **Backend.**

   ```bash
   cd back
   npm run build
   npm run start:prod
   ```

## Sincronización con la base institucional (B4)

- **Solo se sincronizan estudiantes**, con sus notas y su asistencia (ER Tabla 2).
- **El conector** (`ConectorBDConfigurable`) lee el origen configurado en el JSON que indica `CONECTOR_CONFIGURACION` (ejemplo: [`back/conector-institucional.ejemplo.json`](back/conector-institucional.ejemplo.json)): la tabla o vista y el mapeo de cada campo a la columna de la institución. Así no hay que cambiar el esquema del cliente. Las credenciales vienen de `BD_INSTITUCIONAL_*` y la conexión es de solo lectura.
- **Enlaces:**
  - `codigo_asignatura` es el `idCurso` configurado: un curso por asignatura, así que un periodo nuevo exige cursos nuevos con códigos nuevos (D22);
  - el programa se enlaza primero por `idPrograma` y luego por nombre normalizado.
- **Filas inválidas:** se omiten y se cuentan por causa, con los mensajes de la Tabla 2.
- **Atomicidad:** cada ejecución es una sola transacción (ER 3.7 a). Lo que deja de venir en la fuente se conserva (D20).
- **Estudiantes:** los nuevos quedan sin activar y se activan por enlace (D6). La sincronización nunca cambia la contraseña de una cuenta existente.
- **Ejecución:**
  - nocturna, a la hora `SINCRONIZACION_HORA_NOCTURNA` de Bogotá (UTC-5). **No hay recuperación:** si el servidor estaba apagado a esa hora, esa ejecución se pierde;
  - manual, con `npm run sincronizar [-- --curso <idCurso>]` o con `POST /sincronizacion` y `Authorization: Bearer <SINCRONIZACION_SECRETO>`. Si el secreto está vacío, la ruta responde 404.
  - Si ya hay una sincronización en curso, la segunda falla de inmediato (409 en HTTP).

## Alertas, solicitudes y consulta (B6)

Todas las rutas exigen sesión y el rol correspondiente (403 fuera del rol). El identificador del usuario sale siempre de la sesión.

| Ruta | Rol | Respuesta |
|---|---|---|
| `GET /alertas/cursos/:idCurso` | Docente | 200 con notas, asistencia y última sincronización; 403 si el curso es ajeno o no existe |
| `GET /alertas/emitidas?periodo=` | Docente | 200 con las alertas emitidas y su estado de atención (`PENDIENTE` o `ATENDIDA`) |
| `POST /alertas` `{idRegistro, nivelRiesgo, descripcion}` | Docente | 201; genera el caso en la bandeja del programa y notifica al estudiante y al jefe |
| `GET /consulta/registros?periodo=` | Estudiante | 200 con sus notas y asistencia |
| `GET /consulta/alertas?periodo=` | Estudiante | 200 con sus alertas (fecha, curso, nivel y descripción) |
| `GET /consulta/solicitudes` | Estudiante | 200 con sus solicitudes y su estado (`PENDIENTE` o `ATENDIDA`) |
| `POST /solicitudes` `{tipoApoyo, motivo, disponibilidad?}` | Estudiante | 201 con el comprobante (`codigo`); exige al menos un registro académico (matrícula activa, D21) |

- `periodo` es obligatorio y es el del curso (D12), sin formato fijo.
- El estado que ven el estudiante y el docente se deriva del caso: `PENDIENTE` mientras el caso esté pendiente y `ATENDIDA` después, sin ruta ni avance.
- La alerta o la solicitud y su caso se guardan en una sola transacción. Los correos se envían después y no retrasan la respuesta; si el programa no tiene jefe, el caso se guarda igual y solo se omite ese correo.
- Errores: 400 por campos vacíos o inválidos, 403 por rol o recurso ajeno, 503 si la base de datos falla.

## Casos, pertinencia y atención psicológica (B7)

| Ruta | Rol | Respuesta |
|---|---|---|
| `GET /casos/pendientes` | Jefe | Bandeja del programa que dirige: casos pendientes sin ruta (alertas y solicitudes académicas) |
| `GET /casos/:idCaso` | Jefe | Detalle con antecedentes académicos; nunca expediente psicológico |
| `POST /casos/:idCaso/canalizacion` `{ruta}` | Jefe | 200; psicológica: correo a los psicólogos; 409 si ya fue canalizado |
| `POST /pertinencia/:idCaso` `{pertinente, justificacion, reorientar?}` | Psicólogo | 200; toma el caso y lo aprueba, archiva o reorienta |
| `POST /pertinencia/:idCaso/citas` `{fechaHora, modalidad}` | Psicólogo | 201; primera cita; correo al estudiante |
| `GET /atencion/casos` | Psicólogo | Casos por evaluar y asignados, con su expediente |
| `GET /atencion/casos/:idCaso` | Psicólogo | Expediente con antecedentes académicos |
| `POST /atencion/citas/:idCita/reprogramacion` `{fechaHora, modalidad}` | Psicólogo | 200; correo al estudiante |
| `POST /atencion/casos/:idCaso/citas/:idCita/resultado` `{tipo, observaciones, acuerdos, asistencia, requiereSeguimiento, presentaRiesgoCritico}` | Psicólogo | 201; 409 con `requiereConsentimiento` si es menor sin consentimiento |
| `POST /atencion/casos/:idCaso/consentimiento` | Psicólogo | 200; solo para menores de edad |
| `POST /atencion/casos/:idCaso/seguimiento` `{fechaHora, modalidad}` | Psicólogo | 201; correo al estudiante |
| `POST /atencion/casos/:idCaso/cierre` | Psicólogo | 200; 409 si la última asesoría no tiene observaciones |

- **Visibilidad (D18, D19):** el Jefe ve el motivo de una solicitud académica de su programa mientras no se canalice a psicología; nunca ve una solicitud psicosocial ni el expediente. Solo el psicólogo asignado (o cualquiera, si el caso aún no tiene psicólogo) ve el expediente.
- **`fechaHora`:** ISO 8601 con zona horaria (por ejemplo `2026-11-20T09:00:00-05:00`), posterior a la hora actual. El cruce de horario es por fecha y hora exactas (D9).
- **Concurrencia:** las escrituras bloquean el caso y, al programar o reprogramar, la agenda del psicólogo; si la espera supera 5 s se responde 409.
- **Correos de cita:** solo al estudiante (D26); si es menor sin consentimiento, incluyen el requisito del consentimiento firmado por el acudiente.
- **Migración nueva:** `npm run build` y `npm run bd:migrar` (fecha de canalización y trazabilidad del consentimiento).

## Plan de nivelación e informes de riesgo (B8)

| Ruta | Rol | Respuesta |
|---|---|---|
| `POST /planes` `{idCaso, idsCursos, tutorNombre, tutorCodigo, cronograma?}` | Jefe | 201; plan ACTIVO sobre un caso de la ruta académica; correo al estudiante |
| `POST /planes/:idPlan/finalizacion` | Jefe | 200; plan FINALIZADO; el caso sigue EN_NIVELACION |
| `POST /informes` `{periodo, idPrograma?, idCurso}` | Jefe o Psicólogo | 201 con los totales; 200 `{mensaje}` si no hay datos. `idPrograma` es obligatorio para el Psicólogo y no se admite para el Jefe (usa el programa que dirige) |
| `GET /informes/:idInforme/pdf` | Jefe o Psicólogo | PDF adjunto (`informe-riesgo.pdf`); el Jefe solo los de su programa |

- **Cursos del plan:** solo cursos en los que el estudiante tiene registro académico. El tutor es un dato informativo (nombre y código obligatorios).
- **Qué cuenta el informe:** alertas de la asignatura y el periodo; casos cerrados o archivados con origen en una alerta de la asignatura (no los reorientados, ni las solicitudes voluntarias, ni los casos de la ruta académica); planes que refuerzan la asignatura, contados aparte. Solo datos agregados, iguales para el Jefe y el Psicólogo.
- **Migración nueva:** `npm run build` y `npm run bd:migrar` (programa y autor del informe).

## Notificaciones por correo (B5)

- **Proveedor:** Brevo por SMTP (`smtp-relay.brevo.com:587`) con STARTTLS obligatorio, TLS 1.2 como mínimo y verificación del certificado siempre activa. Plazo global de 5 s por envío (ER Tabla 1).
- **Configuración:** variables `CORREO_*` de [`back/.env.example`](back/.env.example). El usuario y la clave SMTP van solo en `back/.env`.
- **Sin configuración SMTP la aplicación no arranca**, salvo que se declare `CORREO_MODO=desactivado`. En ese modo avisa al arrancar, no envía nada y no registra el contenido. No se admite con `NODE_ENV=production`. Las suites de integración y e2e lo fuerzan para no enviar correos reales.
- **Contenido:** HTML, sin datos confidenciales (Manual 4.1.1.6): ni el motivo del caso, ni el contenido de las asesorías, ni la palabra psicología en las citas. Cada correo remite al sistema.
- **Fallos:** el envío no interrumpe el flujo. Se registra «Correo enviado» o «Error de envío» con el tipo y un código técnico, nunca el destinatario, el asunto ni el cuerpo.
- **Correo de prueba:** `npm run build` y luego `npm run correo:prueba -- <destino>`. Envía un correo sin datos del sistema e imprime solo «Correo enviado» o «Error de envío (<código>)»; nunca imprime la configuración ni la clave.

## Autenticación (B3)

- Inicio de sesión con correo y contraseña. Las contraseñas se guardan con bcrypt (costo `BCRYPT_COSTO`).
- La sesión es un JWT HS256 de `SESION_DURACION_MIN` minutos, sin renovación, que viaja en la cookie `detecta_sesion`, con los atributos `HttpOnly`, `SameSite=Strict` y `Secure`. `COOKIE_SEGURA` debe valer `true` en producción.
- Las cuentas nuevas no tienen contraseña: se activan con un enlace de un solo uso que vence en `ACTIVACION_DURACION_MIN` minutos. El mismo flujo sirve para recuperar la contraseña. El enlace llega por correo (B5); para las cuentas cargadas con `datos:iniciales`, el comando también imprime los enlaces en la salida estándar y no envía correos.
- CORS admite solo el origen exacto de `URL_FRONTEND`, con credenciales.

| Ruta | Respuesta |
|---|---|
| `POST /acceso/iniciar-sesion` | 200 `{id, nombre, correo, rol}` y la cookie; 401 con un mensaje genérico |
| `POST /acceso/cerrar-sesion` | 204; expira la cookie |
| `POST /acceso/solicitar-activacion` | 202 siempre, con el mismo cuerpo, exista o no el correo |
| `POST /acceso/activar` | 204; 400 genérico si el enlace no es válido. El token va en el cuerpo, nunca en la URL |
| `GET /acceso/sesion` | 200 `{id, nombre, correo, rol}`; 401 sin sesión |

## Scripts del backend (`back/`)

| Script | Qué hace |
|---|---|
| `npm run build` | Compila a `dist/` |
| `npm run start` / `start:dev` | Arranca la aplicación (con recarga en `start:dev`) |
| `npm run start:prod` | Arranca la versión compilada |
| `npm run lint` | Lint con oxlint (con reglas que usan información de tipos) |
| `npm run typecheck` | Verifica los tipos de todo el proyecto, pruebas incluidas (`tsc --noEmit`) |
| `npm run format` / `format:check` | Aplica o verifica el formato con Prettier |
| `npm test` | Pruebas unitarias |
| `npm run test:e2e` | Conexión a ambas bases, autenticación, correo de activación por un servidor SMTP local, flujos del docente y del estudiante (B6) y disparo manual de la sincronización por HTTP contra `detecta_pruebas` (requiere PostgreSQL en marcha, `back/.env` y `npm run bd:institucional`) |
| `npm run datos:iniciales -- <archivo.json>` | Carga programas, cuentas y cursos iniciales e imprime los enlaces de activación (ver paso 4) |
| `npm run bd:institucional` | Carga `institucional_demo` desde el CSV de demostración (ver paso 5) |
| `npm run sincronizar [-- --curso <idCurso>]` | Sincroniza todos los cursos configurados, o uno solo, desde la base institucional |
| `npm run correo:prueba -- <destino>` | Envía un correo de prueba sin datos del sistema por el proveedor configurado (requiere `npm run build`) |
| `npm run bd:crear` | Crea las bases `institucional_demo` y `detecta_pruebas` y los usuarios (ver paso 3) |
| `npm run bd:migrar` / `bd:revertir` | Aplica o revierte las migraciones en `detecta` con `detecta_migrador` (requiere `npm run build`) |
| `npm run bd:migrar:pruebas` / `bd:revertir:pruebas` | Lo mismo en `detecta_pruebas` |
| `npm run test:integracion` | Pruebas de integración de la persistencia y la sincronización contra `detecta_pruebas` e `institucional_demo` (vacía las tablas de `detecta_pruebas`; requiere `npm run bd:institucional`) |

## Migraciones

El esquema solo cambia mediante migraciones (`synchronize` está desactivado). Están en [`back/src/persistencia/migraciones/`](back/src/persistencia/migraciones/), se escriben a mano y se registran en `MIGRACIONES` de [`back/src/persistencia/fuente-datos.ts`](back/src/persistencia/fuente-datos.ts). Las ejecuta `detecta_migrador`, dueño de las tablas; la aplicación nunca lo usa.

**Convención obligatoria:** toda migración que cree una tabla trae su propio `GRANT` explícito a `detecta_app`, con **solo** `SELECT`, `INSERT` y `UPDATE`. **Nunca `DELETE` ni `TRUNCATE`** (ER 3.7 c: el historial de alertas y casos no se elimina). No se usan permisos por defecto (`ALTER DEFAULT PRIVILEGES`), para que la tabla interna `migraciones_typeorm` quede sin permisos para la aplicación.

```sql
GRANT SELECT, INSERT, UPDATE ON nueva_tabla TO detecta_app;
```

La prueba de integración de permisos recorre **todas** las tablas del esquema `public` (`pg_tables`): una tabla sin su `GRANT`, o con `DELETE` o `TRUNCATE`, la hace fallar.

## Flujo de trabajo

Una rama por fase (`fase/bN-descripcion`), commits pequeños en español. El merge a `main` lo hace el responsable del proyecto después de la auditoría de cada fase.
