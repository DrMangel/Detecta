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
   | `detecta` | `detecta_app` | Conexión y uso del esquema `public`. Las tablas aún no se migran en `detecta` (ver nota de B2) |
   | `detecta_pruebas` | `detecta_migrador` (dueño) y `detecta_app` | El migrador crea las tablas; `detecta_app` solo tiene `SELECT`, `INSERT` y `UPDATE`, nunca `DELETE` ni `TRUNCATE` (ER 3.7 c) |
   | `institucional_demo` | `institucional_lector` | Conexión y uso del esquema `public`, sesiones de solo lectura. La vista institucional se crea en B4 |

   El superusuario `detecta_user` solo se usa para administrar y `detecta_migrador` solo para migraciones; la aplicación usa `detecta_app`.

   **Nota de B2:** las migraciones se aplican por ahora solo a `detecta_pruebas`. Para migrar `detecta`, el migrador necesita permisos en esa base; queda pendiente de decisión.

4. **Backend.**

   ```bash
   cd back
   npm run build
   npm run start:prod
   ```

## Scripts del backend (`back/`)

| Script | Qué hace |
|---|---|
| `npm run build` | Compila a `dist/` |
| `npm run start` / `start:dev` | Arranca la aplicación (con recarga en `start:dev`) |
| `npm run start:prod` | Arranca la versión compilada |
| `npm run lint` | Lint con oxlint (con reglas que usan información de tipos) |
| `npm run format` / `format:check` | Aplica o verifica el formato con Prettier |
| `npm test` | Pruebas unitarias |
| `npm run test:e2e` | Prueba de conexión a ambas bases (requiere PostgreSQL en marcha y `back/.env`) |
| `npm run bd:crear` | Crea las bases `institucional_demo` y `detecta_pruebas` y los usuarios (ver paso 3) |
| `npm run bd:migrar:pruebas` / `bd:revertir:pruebas` | Aplica o revierte las migraciones en `detecta_pruebas` con `detecta_migrador` (requiere `npm run build`) |
| `npm run test:integracion` | Pruebas de integración de la persistencia contra `detecta_pruebas` (vacía sus tablas) |

## Flujo de trabajo

Una rama por fase (`fase/bN-descripcion`), commits pequeños en español. El merge a `main` lo hace el responsable del proyecto después de la auditoría de cada fase.
