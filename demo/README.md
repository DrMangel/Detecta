# Entorno de demostración de DETECTA (F5a)

Este entorno sirve para presentar DETECTA con datos ficticios, aislado del entorno de desarrollo. Usa dos bases propias dentro del contenedor `detecta-postgres`:

| Base | Contenido | Roles |
|---|---|---|
| `detecta_entrega` | Base de DETECTA, creada por las migraciones | `detecta_migrador` (dueño, migraciones) y `detecta_app` (solo `SELECT`, `INSERT` y `UPDATE`, ER 3.7 c) |
| `institucional_entrega` | Base institucional emulada, cargada desde CSV | `institucional_lector` (solo lectura sobre las vistas) |

Los roles son los mismos del entorno de desarrollo. Los scripts nunca tocan `detecta`, `institucional_demo`, `detecta_pruebas`, `detecta_carga` ni `institucional_carga`, y no inician, crean ni recrean contenedores ni volúmenes.

## Instalación

### Requisitos

- Windows con PowerShell 5.1 o superior.
- Node.js 26 o superior y npm 11.
- Docker Desktop, con el contenedor `detecta-postgres` y los roles ya creados según el [README principal](../README.md) (pasos 1 a 3).
- Dependencias instaladas: `npm ci` en `back/` y en `front/`.

### Configuración

1. Copie [`demo/.env.example`](.env.example) a `demo/.env`. Este archivo no se versiona.
2. Complete los secretos locales: contraseñas de `detecta_app`, `institucional_lector` y `detecta_migrador`, `JWT_SECRETO` y las credenciales SMTP de Brevo.
3. No cambie los valores fijos de la demo. Los scripts los comprueban y se detienen si alguno es distinto:
   - las bases `detecta_entrega` e `institucional_entrega`;
   - los puertos 3000 y 5173;
   - `CORREO_RECHAZAR_EJEMPLO_INVALID=true`;
   - `CORREO_DESTINO_PERMITIDO=detectasoportetecnico+*@gmail.com`.

Con esa configuración, el backend de la demo solo envía correo a los alias `detectasoportetecnico+…@gmail.com` y rechaza cualquier otro destinatario antes de conectarse a Brevo. Haga pocas pruebas de envío.

Si alguna variable de `demo/.env` también está definida en la sesión de PowerShell con otro valor, los scripts se detienen. Así se evita que la demo use una base distinta sin aviso.

### Preparación (una vez, o para volver al estado inicial)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\preparar-demo.ps1            # crea lo que falte
powershell -ExecutionPolicy Bypass -File scripts\preparar-demo.ps1 -Reiniciar # borra y recrea solo las dos bases de entrega
```

El script hace lo siguiente:

1. Comprueba Docker, que `detecta-postgres` esté activo y que PostgreSQL acepte conexiones (`pg_isready`).
2. Crea las dos bases y les asigna permisos.
3. Compila el backend y aplica las migraciones a `detecta_entrega`.
4. Carga [`institucional_entrega.csv`](../docker/postgres/institucional_entrega.csv) en `institucional_entrega`.
5. Crea los datos iniciales de [`datos-iniciales.ejemplo.json`](datos-iniciales.ejemplo.json): programas, cursos con su docente, y las cuentas de docente, jefe y psicólogo, con nombres ficticios y alias derivados del nombre (ver «Datos de origen»).

**Enlaces de activación.** Las cuentas nuevas quedan sin activar (D6). Sus enlaces se guardan en `%USERPROFILE%\detecta-entrega\enlaces-activacion.txt`, fuera del repositorio, como respaldo; nunca se muestran en la consola. Las reglas de ese archivo son:

- Cada preparación lo sobrescribe.
- Si las cuentas ya existían, la preparación no genera enlaces nuevos y el archivo queda sin ellos.
- `-Reiniciar` lo borra.

### Arranque

```powershell
powershell -ExecutionPolicy Bypass -File scripts\iniciar-demo.ps1
```

Antes de lanzar nada, el script comprueba:

- `demo/.env`;
- el contenedor;
- que existan las bases de entrega;
- que los puertos 3000 y 5173 estén libres. Si un backend de desarrollo ya ocupa el puerto 3000, el script se detiene para que la demo no use la base `detecta`.

Después lanza el backend con `demo/.env` y el front con Vite. La aplicación queda en <http://localhost:5173>. Con Ctrl+C, o si uno de los dos procesos termina, el script cierra solo los procesos que lanzó, identificados por su PID.

## Guion de integración: CSV → institucional → sincronización → DETECTA

Los comandos se ejecutan desde `back/`, con la demo preparada. Se invocan con `node --env-file=../demo/.env` y no con `npm run`, porque los scripts de npm leen `back/.env`, que apunta a las bases de desarrollo.

### 1. Datos de origen (Manual, Tabla 25)

[`institucional_entrega.csv`](../docker/postgres/institucional_entrega.csv) tiene 80 filas con las columnas de la Tabla 25 del Manual y otras que el conector no usa (semestre, créditos, estado de matrícula, docente). Incluye:

- el curso ISOF-101 con 60 estudiantes;
- 5 estudiantes menores de edad;
- casos de riesgo por nota (inferior a 3,0) y por asistencia (inferior al 80 %);
- valores fuera de rango, una matrícula inactiva, un programa inexistente, un nombre de programa sin tilde y un curso no configurado (QUIM-999), para mostrar las omisiones con los mensajes de la Tabla 2 del ER.

Los nombres son ficticios, de apariencia real. Cada persona, estudiante o cuenta de `datos-iniciales.ejemplo.json`, tiene un único alias de la cuenta de soporte derivado de su nombre: `detectasoportetecnico+<nombre>.<apellido1>@gmail.com`, en minúsculas, sin tildes ni dígitos. Todos cumplen `CORREO_DESTINO_PERMITIDO`, y las filas de un mismo estudiante en dos cursos llevan el mismo correo. El inicio de sesión distingue mayúsculas en el correo. [`datos-entrega.spec.mjs`](../docker/postgres/datos-entrega.spec.mjs) comprueba la regla, los conteos y el desglose de omisiones.

### 2. Carga en la base institucional

```powershell
node ../docker/postgres/cargar-institucional.mjs --base institucional_entrega
```

El cargador solo acepta `institucional_demo` e `institucional_entrega`. Vacía y recarga la tabla en una sola transacción y muestra el número de filas cargadas.

### 3. Sincronización y medición (ER 3.4: curso de 60 en menos de 10 s)

```powershell
Measure-Command { node --env-file=../demo/.env dist/comandos/sincronizar.js --curso ISOF-101 | Out-Default }
```

La salida muestra los mensajes de la sincronización y el desglose de omisiones. `TotalSeconds` incluye el arranque de Node y de NestJS, así que es una cota superior del tiempo de sincronización: si es menor de 10 s, se cumple la meta. Para sincronizar todos los cursos configurados, omita `--curso ISOF-101`.

### 4. Resultado en DETECTA

Abra la aplicación en el navegador y siga estos pasos:

1. **Activar la cuenta del docente.** Abra **Solicitar activación** (`/solicitar-activacion`) con el correo de la cuenta `DOCENTE` de [`datos-iniciales.ejemplo.json`](datos-iniciales.ejemplo.json). El correo llega por Brevo a la bandeja de `detectasoportetecnico@gmail.com`. Si el correo no llega, use como respaldo el enlace guardado en `enlaces-activacion.txt`.
2. **Revisar los cursos.** El docente ve ISOF-101 con los estudiantes sincronizados y sus indicadores de riesgo.
3. **Activar una cuenta de estudiante.** Repita la solicitud de activación con el correo de un estudiante del CSV, por ejemplo el de 2026001.

### 5. Variante con columnas ficticias (ER 3.7 e; paso aparte)

Este paso demuestra que el mapeo de campos se configura sin tocar el esquema del cliente.

```powershell
node ../docker/postgres/cargar-institucional.mjs --base institucional_entrega --variante alternativa
```

Después:

1. Cambie en `demo/.env` el valor de `CONECTOR_CONFIGURACION` a `../demo/conector-institucional-alternativa.ejemplo.json`.
2. Repita el paso 3. El resultado debe ser el mismo que con la Tabla 25.
3. Restaure el valor original de `CONECTOR_CONFIGURACION`.

## Despliegue en línea (F6)

Enlace público: <https://detecta-web.onrender.com>. Solo usa los datos ficticios de esta carpeta, sin costo.

### Arquitectura

| Nodo | Servicio | Función |
|---|---|---|
| Navegador | — | Habla solo con `detecta-web.onrender.com` por HTTPS |
| `detecta-web` | Render, sitio estático (plan gratuito) | Sirve el front compilado (`VITE_URL_API=/api`). Reescribe `/api/*` hacia la API, sin el prefijo, y el resto hacia `index.html` |
| `detecta-api` | Render, servicio web Node 26 (plan gratuito, Ohio) | El backend NestJS (`npm run start:prod`) |
| Neon, proyecto `Detecta` | PostgreSQL 18 (plan gratuito, `aws-us-east-2`, Ohio) | Bases `detecta_entrega` e `institucional_entrega`, con los mismos roles y permisos de F5a. Conexión directa (sin `-pooler`) con TLS `verify-full` |
| Brevo | SMTP `smtp-relay.brevo.com:2525` con STARTTLS | Correo. Render gratis bloquea los puertos 25, 465 y 587 |

**Por qué el reenvío de `/api`:** `onrender.com` está en la Public Suffix List, así que dos subdominios suyos son sitios distintos. Con el reenvío, el navegador ve un solo sitio y la cookie de sesión conserva `HttpOnly`, `Secure` y `SameSite=Strict` sin cambios. CORS sigue admitiendo solo `https://detecta-web.onrender.com`.

La configuración está en [`render.yaml`](../render.yaml), que Render usa como Blueprint. Lo que no es secreto va en el archivo; los 9 secretos (`sync: false`) se cargan a mano en **detecta-api → Environment**:

- `BD_DETECTA_HOST`, `BD_DETECTA_CONTRASENA`, `BD_INSTITUCIONAL_HOST`, `BD_INSTITUCIONAL_CONTRASENA`;
- `JWT_SECRETO`, `SINCRONIZACION_SECRETO`;
- `CORREO_SMTP_USUARIO`, `CORREO_SMTP_CLAVE`, `CORREO_REMITENTE`.

Render despliega desde `main` (J4): los dos servicios declaran `branch: main` y el Blueprint se sincroniza desde `main`. Durante F6 desplegó desde `fase/f6-despliegue`.

### Preparar las bases remotas

1. Copie [`demo/.env.remoto.example`](.env.remoto.example) a `demo/.env.remoto`. No se versiona.
2. Complete los hosts y la cadena **directa** del dueño de Neon (con «Connection pooling» desactivado), las contraseñas de los tres roles, `JWT_SECRETO` y `SINCRONIZACION_SECRETO`. Este último debe ser el mismo que en Render.
3. Ejecute:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\preparar-remoto.ps1                # prepara y verifica
   powershell -ExecutionPolicy Bypass -File scripts\preparar-remoto.ps1 -SoloVerificar # solo verifica
   powershell -ExecutionPolicy Bypass -File scripts\preparar-remoto.ps1 -Reiniciar     # borra y recrea solo las dos bases remotas
   ```

   Después de `-Reiniciar`, repita la sincronización y la preactivación del apartado siguiente.

El script necesita Docker y la imagen local `postgres:18`. `psql` corre en un contenedor temporal (`docker run --rm`), porque esa imagen no trae certificados raíz y `verify-full` necesita uno: se le montan en solo lectura las raíces de confianza que trae Node. No modifica `detecta-postgres` ni ninguna base local, y es idempotente: no borra bases ni datos. Hace lo siguiente:

1. comprueba que el servidor sea PostgreSQL 18;
2. crea o actualiza los roles, las bases y sus permisos;
3. aplica las migraciones y carga la Tabla 25;
4. crea los datos iniciales. Los enlaces van a `%USERPROFILE%\detecta-entrega\enlaces-activacion-remoto.txt`;
5. verifica los atributos de los roles, cuenta los privilegios de `detecta_app` e intenta de verdad, dentro de transacciones revertidas, un `DELETE`, un `TRUNCATE`, un `UPDATE` de `evento_caso` y una lectura de la tabla base como lector. Todos deben ser rechazados.

### Sincronizar y preactivar las cuentas del evaluador

Desde la raíz, con el servicio `detecta-api` activo:

```powershell
node scripts/sincronizar-remoto.mjs   # POST /api/sincronizacion con el secreto; muestra el resultado
node scripts/preactivar-remoto.mjs    # activa 5 cuentas por el flujo real (J8)
```

`preactivar-remoto.mjs` funciona así:

- emite un enlace de un solo uso (`datos-iniciales --enlace`) y activa la cuenta con una contraseña aleatoria mediante `POST /api/acceso/activar`;
- comprueba el inicio de sesión;
- lo hace con el docente, el jefe, el psicólogo, el estudiante adulto 2026001 y el estudiante menor de edad 2026005, con el nombre y el correo que leen de `datos-iniciales.ejemplo.json` y de `institucional_entrega.csv`;
- guarda las credenciales solo en `%USERPROFILE%\detecta-entrega\cuentas-evaluador.txt`, una línea por cuenta con `rol | nombre | correo | contraseña`. Ivan decide por qué canal se entregan.

Cada ejecución renueva todas las contraseñas.

### Antes de la sustentación

- **El servicio se duerme.** Render apaga el servicio gratuito tras 15 minutos sin tráfico, y el primer acceso tarda alrededor de un minuto.
- **Monitor externo (J3).** Sondea cada 10 minutos `GET https://detecta-web.onrender.com/api/salud`, que responde **200** con `{"estado":"ok"}`. Es una ruta pública que no consulta la base, no usa el limitador ni crea sesión. Así Neon puede seguir suspendiéndose y no consume cómputo. Nunca use una ruta que consulte la base. Un servicio despierto todo el mes gasta como máximo 744 de las 750 horas gratuitas, así que no cree otro servicio web en el espacio de trabajo.
- **Sin monitor.** Abra el enlace 3 a 5 minutos antes de la presentación.
- **Una semana antes,** revise en Neon el consumo de cómputo (100 CU-h al mes) y en Brevo el de correos (300 al día).
- **Respaldo.** Neon gratis no hace respaldos automáticos. Solo permite restaurar a un punto en el tiempo dentro de las últimas 6 horas y guardar una instantánea manual. Para volver al estado inicial, use `-Reiniciar`, sincronice y preactive.
- **Tiempo de inicio de sesión.** Con 0,1 CPU, iniciar sesión tarda unos 2 s y a veces más (D40).

## Pruebas de los scripts

```powershell
node --test scripts/*.spec.mjs docker/postgres/cargar-institucional.spec.mjs docker/postgres/datos-entrega.spec.mjs
```

Ejecute este comando desde la raíz del repositorio.
