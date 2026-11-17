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

## Autenticación (B3)

- Inicio de sesión con correo y contraseña. Las contraseñas se guardan con bcrypt (costo `BCRYPT_COSTO`).
- La sesión es un JWT HS256 de `SESION_DURACION_MIN` minutos, sin renovación, que viaja en la cookie `detecta_sesion`, con los atributos `HttpOnly`, `SameSite=Strict` y `Secure`. `COOKIE_SEGURA` debe valer `true` en producción.
- Las cuentas nuevas no tienen contraseña: se activan con un enlace de un solo uso que vence en `ACTIVACION_DURACION_MIN` minutos. El mismo flujo sirve para recuperar la contraseña. Hasta que llegue el proveedor de correo real (B5), la aplicación no envía correos: los enlaces se obtienen con `datos:iniciales`.
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
| `npm run format` / `format:check` | Aplica o verifica el formato con Prettier |
| `npm test` | Pruebas unitarias |
| `npm run test:e2e` | Conexión a ambas bases, autenticación y disparo manual de la sincronización por HTTP contra `detecta_pruebas` (requiere PostgreSQL en marcha, `back/.env` y `npm run bd:institucional`) |
| `npm run datos:iniciales -- <archivo.json>` | Carga programas, cuentas y cursos iniciales e imprime los enlaces de activación (ver paso 4) |
| `npm run bd:institucional` | Carga `institucional_demo` desde el CSV de demostración (ver paso 5) |
| `npm run sincronizar [-- --curso <idCurso>]` | Sincroniza todos los cursos configurados, o uno solo, desde la base institucional |
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
