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
5. Crea los datos iniciales de [`datos-iniciales.ejemplo.json`](datos-iniciales.ejemplo.json): programas, cursos con su docente, y las cuentas de docente, jefe y psicólogo con alias `+<rol>`.

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

Cada estudiante tiene un único alias `detectasoportetecnico+estNN@gmail.com`.

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

1. **Activar la cuenta del docente.** Abra **Solicitar activación** (`/solicitar-activacion`) con `detectasoportetecnico+docente@gmail.com`. El correo llega por Brevo a la bandeja de `detectasoportetecnico@gmail.com`. Si el correo no llega, use como respaldo el enlace guardado en `enlaces-activacion.txt`.
2. **Revisar los cursos.** El docente ve ISOF-101 con los estudiantes sincronizados y sus indicadores de riesgo.
3. **Activar una cuenta de estudiante.** Repita la solicitud de activación con un alias `+estNN`.

### 5. Variante con columnas ficticias (ER 3.7 e; paso aparte)

Este paso demuestra que el mapeo de campos se configura sin tocar el esquema del cliente.

```powershell
node ../docker/postgres/cargar-institucional.mjs --base institucional_entrega --variante alternativa
```

Después:

1. Cambie en `demo/.env` el valor de `CONECTOR_CONFIGURACION` a `../demo/conector-institucional-alternativa.ejemplo.json`.
2. Repita el paso 3. El resultado debe ser el mismo que con la Tabla 25.
3. Restaure el valor original de `CONECTOR_CONFIGURACION`.

## Pruebas de los scripts

```powershell
node --test scripts/validar-entorno-demo.spec.mjs docker/postgres/cargar-institucional.spec.mjs
```

Ejecute este comando desde la raíz del repositorio.
