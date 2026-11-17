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

4. **Datos iniciales.** Programas y cuentas que no llegan por sincronización (docentes, jefes de departamento con su programa y psicólogos). Copia [`back/datos-iniciales.ejemplo.json`](back/datos-iniciales.ejemplo.json) a `back/datos-iniciales.json` (fuera de git: contiene datos personales, Ley 1581) y complétalo. El script es idempotente por correo: no duplica ni modifica cuentas existentes. Por cada cuenta nueva imprime **una sola vez** su enlace de activación en la terminal.

   ```bash
   cd back
   npm run build
   npm run datos:iniciales -- datos-iniciales.json
   npm run datos:iniciales -- --enlace correo@ejemplo.edu.co   # enlace nuevo para una cuenta existente
   ```

5. **Backend.**

   ```bash
   cd back
   npm run build
   npm run start:prod
   ```

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
| `npm run test:e2e` | Conexión a ambas bases y autenticación de punta a punta por HTTP, esta última contra `detecta_pruebas` (requiere PostgreSQL en marcha y `back/.env`) |
| `npm run datos:iniciales -- <archivo.json>` | Carga programas y cuentas iniciales e imprime sus enlaces de activación (ver paso 4) |
| `npm run bd:crear` | Crea las bases `institucional_demo` y `detecta_pruebas` y los usuarios (ver paso 3) |
| `npm run bd:migrar` / `bd:revertir` | Aplica o revierte las migraciones en `detecta` con `detecta_migrador` (requiere `npm run build`) |
| `npm run bd:migrar:pruebas` / `bd:revertir:pruebas` | Lo mismo en `detecta_pruebas` |
| `npm run test:integracion` | Pruebas de integración de la persistencia contra `detecta_pruebas` (vacía sus tablas) |

## Migraciones

El esquema solo cambia mediante migraciones (`synchronize` está desactivado). Están en [`back/src/persistencia/migraciones/`](back/src/persistencia/migraciones/), se escriben a mano y se registran en `MIGRACIONES` de [`back/src/persistencia/fuente-datos.ts`](back/src/persistencia/fuente-datos.ts). Las ejecuta `detecta_migrador`, dueño de las tablas; la aplicación nunca lo usa.

**Convención obligatoria:** toda migración que cree una tabla trae su propio `GRANT` explícito a `detecta_app`, con **solo** `SELECT`, `INSERT` y `UPDATE`. **Nunca `DELETE` ni `TRUNCATE`** (ER 3.7 c: el historial de alertas y casos no se elimina). No se usan permisos por defecto (`ALTER DEFAULT PRIVILEGES`), para que la tabla interna `migraciones_typeorm` quede sin permisos para la aplicación.

```sql
GRANT SELECT, INSERT, UPDATE ON nueva_tabla TO detecta_app;
```

La prueba de integración de permisos recorre **todas** las tablas del esquema `public` (`pg_tables`): una tabla sin su `GRANT`, o con `DELETE` o `TRUNCATE`, la hace fallar.

## Flujo de trabajo

Una rama por fase (`fase/bN-descripcion`), commits pequeños en español. El merge a `main` lo hace el responsable del proyecto después de la auditoría de cada fase.
