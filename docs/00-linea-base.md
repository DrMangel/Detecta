# DETECTA — Línea base para la implementación del backend

Documento de trabajo, no es la documentación técnica definitiva. Estado al 17 de noviembre de 2026 (actualizado tras las fases B0 a B3).
Reúne lo que el agente de codificación necesita saber y no puede inferir de los diagramas: versiones vigentes, decisiones, diferencias entre fuentes y puntos abiertos.

## 1. Orden de autoridad

1. Diagramas en `docs/diagramas/` (vigentes y aprobados por Ivan el 16/11/2026).
2. Este documento.
3. ER (v1.4, 04/11/2026) y Manual del sistema (v1.2, 30/10/2026) en `docs/referencias/` (`ER_6.docx` y `Manual del sistema_6.docx`). La versión del ER en el repositorio ya incluye `fecha_nacimiento` en la Tabla 2 (D5) y la redacción del 3.5.5 sobre el origen del caso (D7), aunque su tabla de control sigue en la v1.4.
   - Ajuste por D18 (18/11/2026), sin cambio de nombre (el `_6` es el número del grupo, no la versión):
     - ER: 3.5.3, 3.5.6, 3.6 "Funciones de control", 3.7 c y R02. R02 incluye ahora el aviso al estudiante, antes del envío, de quién podrá ver su solicitud: el Psicólogo si es psicosocial o el Jefe de Departamento de Programa si es académica.
     - Manual: CUD02 (paso del aviso al estudiante y regla de visibilidad) y 2.1.2 c (expediente psicológico solo para psicología; cada solicitud solo para el destinatario que elige el estudiante).
   - SHA-256 de los archivos vigentes:
     - `ER_6.docx`: `466F1A44DB8E7AF68725E03ED9FE785B1860918036B04548A2EE16C3D96E7E5A`
     - `Manual del sistema_6.docx`: `29ED9A2FC9BC1BA28D33BE14574D049B2D682D66E39F9DF5B2B593B0543A361F`
4. `docs/plan-backend.md`.

Ante una contradicción no resuelta aquí: detenerse y preguntar.

## 2. Artefactos vigentes

| Artefacto | Archivo | Notas |
|---|---|---|
| Diagrama de clases (v3) | `diagramas/clases_v3.png` | Controladores, servicios, interfaces, adaptadores y repositorios |
| Diagrama de entidades | `diagramas/entidades_v1.png` | 16 entidades y 9 enumerados |
| Diagrama de paquetes | `diagramas/paquetes.png` | Estructura de carpetas del repositorio |
| Vista de escenarios | `diagramas/vista_de_escenarios.png` | Casos de uso de diseño |
| Secuencias CUD01, 02, 03, 04, 06, 10 | `diagramas/sd_CUD*.png` | Detalle de las operaciones por caso de uso |

Los diagramas están como imágenes (los fuentes PlantUML pueden agregarse en `diagramas/`; en ese caso tienen prioridad sobre el PNG). Si algún detalle de una imagen no es legible, preguntar; no suponerlo.

## 3. Trazabilidad: requisito, caso de uso, controlador y fase

| Requisito (ER) | Caso de uso de diseño | Controlador / servicio | Fase |
|---|---|---|---|
| (acceso) | n/a | `ControladorAcceso`, `ServicioAutenticacion` | B3 |
| (sincronización) | n/a | `ControladorSincronizacion`, `ServicioSincronizacion` | B4 |
| (notificaciones) | n/a | `ServicioNotificacion`, `ProveedorCorreo` | B5 |
| R01 Gestionar alertas académicas tempranas | CUD03 | `ControladorAlertas` | B6 |
| R02 Solicitar acompañamiento voluntario | CUD02 | `ControladorSolicitudes` | B6 |
| Consulta de información académica (no es RF, sí es diseño) | CUD01 | `ControladorConsultaEstudiante` (estudiante); `ControladorAlertas.consultarCurso` y `consultarAlertasEmitidas` (docente) | B6 |
| R03 Gestionar caso de riesgo | CUD04 | `ControladorCasosRiesgo` | B7 |
| R05 Evaluar pertinencia de la solicitud | CUD07 (incluido en CUD06) | `ControladorPertinencia` | B7 |
| R06 Gestionar expediente de atención psicológica | CUD06; incluye CUD07 y CUD08; extendido por CUD09 | `ControladorAtencionPsicologica` | B7 |
| R04 Gestionar plan de nivelación académica | CUD05 (extiende CUD04) | `ControladorPlanNivelacion` | B8 |
| R07 Generar informes de riesgo por asignatura | CUD10 | `ControladorInformes`, `GeneradorInformeRiesgo` | B8 |

Nombres de los casos de uso: CUD01 Consultar información académica; CUD02 Solicitar acompañamiento voluntario; CUD03 Gestionar alertas académicas tempranas; CUD04 Gestionar caso de riesgo; CUD05 Gestionar plan de nivelación académica; CUD06 Gestionar expediente de atención psicológica; CUD07 Evaluar pertinencia de la solicitud; CUD08 Registrar resultado de asesoría; CUD09 Confirmar consentimiento informado; CUD10 Generar informes de riesgo por asignatura.
CUD05, CUD07, CUD08 y CUD09 no tienen diagrama de secuencia propio: están dentro de CUD04 y CUD06.

## 4. Decisiones vigentes de análisis y diseño

**Actores y roles**
- Actores del sistema: Estudiante, Docente, Jefe de Departamento de Programa y Psicólogo. El enumerado `Rol` tiene exactamente esos cuatro valores.
- No existen en el sistema los roles Coordinador, Administrador, Acudiente ni Vicerrector. Aparecen solo en el modelo de negocio (Manual).

**Alertas y casos**
- La alerta la emite el docente manualmente. No hay generación automática de alertas.
- Toda alerta o solicitud (`OrigenRiesgo`) genera un `CasoRiesgo`. La solicitud psicosocial nace con ruta `PSICOLOGICA`; la académica y la alerta nacen sin ruta y las canaliza el Jefe.
- La ruta vive solo en `CasoRiesgo` (`ruta: RutaAtencion`). Con ruta `ACADEMICA` el Jefe estructura el `PlanNivelacion`; con ruta `PSICOLOGICA` el Psicólogo evalúa la pertinencia.
- Cada caso lo atiende un solo psicólogo. `CasoRiesgo.asignarPsicologo(psicologo)` devuelve Boolean y es falso si el caso ya tiene otro psicólogo.
- `CasoRiesgo.cerrar()` devuelve Boolean y es falso si la última asesoría no está completa (R06).

**Programa y Jefe de Departamento**
- Existe la entidad `Programa` con atributos `idPrograma` y `nombre`. Cada programa tiene un solo Jefe (`JefeDepartamento` dirige `Programa`, 1 a 1) y cada estudiante cursa un programa.
- La bandeja del Jefe son los casos cuyo estudiante cursa el programa que dirige.
- El identificador del programa se llama **`idPrograma`** (confirmado por Ivan el 16/11/2026). En los diagramas de clases v3 y en las secuencias CUD02, CUD03, CUD04 y CUD10 algunos parámetros todavía se llaman `codigoPrograma`: son el mismo concepto. Implementar siempre `idPrograma` (parámetros, columnas, DTOs).
- Qué Jefe dirige cada programa lo configura el responsable del despliegue; no hay pantalla para ello.

**Menores de edad y consentimiento**
- El Acudiente no es clase ni actor del sistema; la firma del consentimiento ocurre fuera del sistema.
- Si el estudiante es menor de edad (`Estudiante.esMenorDeEdad(fechaActual)`, a partir de `fechaNacimiento`), el sistema solo pregunta al Psicólogo si el acudiente otorgó el consentimiento. Se registra en `CasoRiesgo.consentimientoConfirmado`.
- Operaciones: `requiereConsentimiento(fechaActual)`, `habilitadoParaAtencion(fechaActual)`, `confirmarConsentimiento()`. La confirmación se hace en `ControladorAtencionPsicologica.confirmarConsentimiento` (R06).

**Plan de nivelación y citas**
- El tutor es un dato informativo: `tutorNombre` y `tutorCodigo` (texto) en `PlanNivelacion`, sin validación ni gestión de tutorías.
- Estados de cita: `PROGRAMADA`, `REPROGRAMADA`, `CERRADA`. La cita pasa a `CERRADA` al generar la `Asesoria` (con o sin asistencia). La asistencia vive en `Asesoria.asistencia`.

**Sincronización con la BD institucional**
- Conexión de solo lectura. Trae estudiantes con sus notas y asistencia. Docente, Curso, la asignación docente–curso, Programa y su Jefe los configura el responsable del despliegue.
- Disparo: tarea nocturna del backend más orden manual del administrador fuera de la aplicación. No se crea rol Administrador. `ControladorSincronizacion` y `ControladorAcceso` no heredan de `ControladorBase`.

**Persistencia y arquitectura**
- Patrón Repositorio opción B: `Repositorio<T>` como base más seis repositorios especializados (`RepositorioPersona`, `RepositorioCasoRiesgo`, `RepositorioAlerta`, `RepositorioSolicitud`, `RepositorioRegistroAcademico`, `RepositorioPlanNivelacion`). El adaptador es `RepositorioPersistente<T>` como base genérica, con seis subclases (una por contrato especializado), según la nota del diagrama de clases v3; no un único adaptador. Las entidades sin contrato especializado (Programa, Curso, Cita, Asesoria, InformeRiesgo) usan instancias de `RepositorioPersistente<T>` sin subclase (decidido en B2).
- Los controladores heredan de `ControladorBase` (verifica permisos con `ControlAcceso`). No hay dependencia de código desde controladores ni servicios hacia `persistencia` o `integracion`: los adaptadores se inyectan al iniciar.
- `contrasenaHash` es un atributo privado de `Persona`.
- Token de sesión en cookie `HttpOnly`, `Secure` y `SameSite`.

## 4.1 Reglas del dominio fijadas en B1

- **Creación de un caso:** nace en estado `PENDIENTE`.
  - De una alerta: sin ruta y con `confidencialidad = false` (inferencia).
  - De una solicitud: `confidencialidad = true`. Si `tipoApoyo` es `PSICOLOGICA`, nace con ruta `PSICOLOGICA`; si es académica, sin ruta.
  - Un origen genera como máximo un caso.
- **`canalizar(ruta)`:** solo una vez. `ACADEMICA` lleva a `EN_NIVELACION`; `PSICOLOGICA` deja el caso en `PENDIENTE` (entra en pendientes de ruta psicológica).
- **`asignarPsicologo`:** exige ruta `PSICOLOGICA`; devuelve `false` si ya hay otro psicólogo; lleva a `EN_EVALUACION`.
- **`aprobar()`:** exige ruta `PSICOLOGICA`, psicólogo asignado y estado `EN_EVALUACION`; no cambia el estado (`EstadoCaso` no tiene un valor "aprobado").
- **`programarCita`:** exige ruta `PSICOLOGICA`, psicólogo asignado y que no haya cruce de horario (misma fecha y hora exactas con una cita `PROGRAMADA` o `REPROGRAMADA` del psicólogo; D9). La primera cita lleva a `CITADO` y las siguientes a `EN_SEGUIMIENTO`. No exige consentimiento (ER R05). La cita se agrega a la agenda del psicólogo.
- **`archivar` y `reorientar`:** llevan a `ARCHIVADO` y `REORIENTADO` y exigen justificación no vacía (Manual CU_10).
- **`cerrar()`:** `CERRADO` si la asesoría de la última cita (la de fecha y hora más reciente) está completa (observaciones no vacías, ER R06); si no, devuelve `false`.
- **Estados terminales** (no admiten más cambios): `CERRADO`, `ARCHIVADO` y `REORIENTADO`. `estaFinalizado()` es verdadero solo para `CERRADO` y `ARCHIVADO` (D11 abierta).
- **Cita:** `reprogramar` no se permite si está `CERRADA`; `generarAsesoria` la cierra.
- **Mayoría de edad:** 18 años (inferencia).

## 4.2 Reglas diferidas a otras fases

- Hecho en B7: el bloqueo del registro del resultado de un menor sin consentimiento (ER R06, situación 2) con `habilitadoParaAtencion`; el cruce de horario al reprogramar (excluye la propia cita); D18 en `puedeVerContenidoConfidencial`; canalizar exige jefe en el programa (409 con mensaje claro) y el caso sin jefe es visible por programa.
- Hecho en B9:
  - D15 (limitador en memoria del inicio de sesión y de las solicitudes de activación), cabeceras de seguridad y `Cache-Control: no-store`;
  - `UV_THREADPOOL_SIZE`, `BD_DETECTA_POOL_MAX` y `BD_DETECTA_CONEXION_ESPERA_MS`, opcionales;
  - consultas en serie dentro de las transacciones (aviso de `pg`) y `trazarCaso` en un solo UPDATE;
  - trazabilidad del caso (ER 1.3.4, CUD04) con la tabla `evento_caso`, de solo inserción;
  - mediciones M1 a M8 sobre `detecta_carga` (sección 11), incluidas `sincronizarTodo` con 2000 estudiantes, `listarPorRol(PSICOLOGO)`, `reprogramarCita`, las bandejas del Jefe y del psicólogo y el informe.
- Sigue vigente tras B9 (medido, sin cambios por falta de evidencia; ver §8):
  - el estado compartido del conector (D33);
  - los envíos de correo en segundo plano se pierden si el proceso muere (D24);
  - `reprogramarCita` carga los casos del psicólogo y `GeneradorInformeRiesgo` filtra en memoria, ambos dentro de sus metas.
- Para F1 (frontend):
  - si la base de datos no está disponible al radicar una solicitud (R02, 503), conservar una copia temporal local del formulario para reintentar. **Resuelto en F1:** R02, el Manual (CUD02 6.a) y sd_CUD02 solo piden conservar los datos en el formulario, no entre recargas; la copia vive solo en la memoria del componente (diferencia para la v4 en «Decisiones y textos del frontend (F1)», §7);
  - evitar el doble envío de los formularios, porque cada alerta o solicitud genera su propio caso. **Resuelto en F1 para la solicitud** (botón deshabilitado y conciliación tras un error de red); F2 lo aplica a la alerta;
  - la prueba del 401 real contra el backend (sesión caducada en una petición protegida) se hace con la primera ruta protegida de F1. **Hecha en F1** con `GET /consulta/registros` tras borrar la cookie;
  - en desarrollo, la consulta inicial de sesión aparece dos veces en la red porque React `StrictMode` ejecuta dos veces los efectos; en producción es una sola. Lo mismo ocurre con `GET /consulta/solicitudes` al abrir «Mis solicitudes»;
  - falta el favicon (404 en desarrollo). **Pendiente para F5** (decisión de Ivan en el cierre de F1).
- Para el ER y F1: el aviso de R02 al estudiante debería decir también que una solicitud académica puede ser remitida a psicología si el Jefe de Departamento lo considera necesario (en ese caso el Jefe deja de ver su contenido y lo ve el psicólogo). **Incorporado en F1** como complemento del aviso académico; el ER R02 se actualizará aparte.
- Para el cierre del proyecto: actualizar los diagramas v3 a una v4 con las diferencias registradas en el §7.

**Estado de las fases**

| Fase | Estado |
|---|---|
| B0, B1, B2 y B3 | Cerradas (17/11/2026) |
| B4 | Cerrada (17/11/2026): 181 pruebas unitarias, 83 de integración y 33 e2e |
| B5 | Cerrada (17/11/2026): 221 pruebas unitarias, 89 de integración y 37 e2e. Verificación del correo real con Brevo pendiente de Ivan |
| B6 | Cerrada (18/11/2026): 277 pruebas unitarias, 96 de integración y 48 e2e |
| B7 | Cerrada (18/11/2026): 353 pruebas unitarias, 108 de integración y 62 e2e |
| B8 | Cerrada (18/11/2026): commits 73d3f23 (B8a) y f6a6afd (B8b); 403 pruebas unitarias, 113 de integración y 69 e2e. Fases B0 a B8 cerradas |
| B9 | Cerrada (19/11/2026): commits 048b019, be3778c, 43f69da, aaa6b45, 04016b9, 490230a, cb4dae3, e0dddbe, 2157ee0, 234e8d6, e1c1ac2, 0088881 y el commit de docs de la fase; 449 pruebas unitarias, 131 de integración y 79 e2e. Fases B0 a B9 cerradas |
| F0 | Cerrada (19/11/2026): commits c7039e5, 3021d7a, 38b7c5a, f50cc87, 75e2f46, 272a511 y el commit de docs de la fase; 52 pruebas de componentes (Vitest). Prueba manual en Chrome contra el backend real con una cuenta de cada rol |
| F1 | Cerrada (19/11/2026, merge 1d433c7): commits a5dac36, 27e303b, f58450e, 041faa9, 6b925c1, 4119f11 y 65e50c5; 97 pruebas de componentes (Vitest). Prueba manual en Chrome a 360 px contra el backend real con la cuenta del estudiante de ejemplo |
| F2 | Cerrada (19/11/2026, merge 1842984): fusionada en main por el PR #14 con merge commit; commits fbf9587, 3c52d69, 3446d2e, d591393, d783391 y el commit de docs del cierre; 142 pruebas de componentes (Vitest). Prueba manual en Chrome a 1280 y 360 px contra el backend real con la cuenta del docente de ejemplo |
| F1b | Cerrada parcialmente (19/11/2026, merge ec9a4c6, PR #15): 16 commits de refactorización (7150490 a fe44b3b) sin cambios de textos ni de comportamiento y el commit de docs 976d70d; 179 pruebas de componentes (Vitest). Desvío menor aceptado: las extracciones c92a985 (aviso y comprobante de R02) y fe44b3b (`useBorrador`) no estaban en la lista aprobada. Pasan a la pasada de F5: las reglas de lint restantes como error, los 3 ítems de adelgazamiento (`Resultado.periodo`, `export` sobrantes, rótulos compartidos), la línea de partida de jscpd, la medición del backend en la §11, las métricas antes/después y la evidencia de pruebas en rojo. El stash `f1b-pendiente-formulario-alerta` se conserva sin aplicar |
| F3 | Aprobada (19/11/2026) con prueba manual reducida: commits 75b514a, 531024e, b27cfa9, 3358951, 298c901, b605fbc, ac74d61 y el commit de docs del resultado de la prueba; 209 pruebas de componentes (Vitest). El hash del merge se registra en el commit de docs de la fase siguiente |

## 5. Decisiones técnicas del entorno y del plan

Estas decisiones no están en los diagramas; vienen de Ivan (plan del backend y entorno):

- PostgreSQL 18 en Docker, ya configurado en el entorno de desarrollo.
- Dos bases de datos: `detecta` e `institucional_demo`. La segunda simula la BD institucional con un CSV y una vista de solo lectura.
- TypeORM con herencia de tabla única para `Persona`.
- Autenticación con JWT en cookie y bcrypt.
- Correo por SMTP/TLS con Brevo, detrás de la interfaz `ProveedorCorreo`.
- El usuario de base de datos de la aplicación no tiene permiso de eliminación (ER 3.7 c: el historial de alertas y casos no se elimina).
- Las rutas REST, los DTO y los códigos de error **no están definidos** en los diagramas; el agente debe proponerlos en el plan de cada fase y esperar aprobación.
- Las rutas de `/acceso` están definidas desde B3: `POST /acceso/iniciar-sesion`, `POST /acceso/cerrar-sesion`, `POST /acceso/solicitar-activacion`, `POST /acceso/activar` y `GET /acceso/sesion`. Las demás rutas siguen sin definirse.
- **`GET /salud` (F6, cambio operativo aprobado por Ivan):** ruta pública, sin sesión, sin base de datos y sin limitador. Responde 200 con el cuerpo fijo `{"estado":"ok"}`. Solo sirve para que el monitor externo mantenga despierto el servicio gratuito (J3). No está en los diagramas ni cambia ningún caso de uso.
- **Restricción de despliegue:** la cookie de sesión es `SameSite=Strict`, así que el front y la API deben estar en el mismo sitio (mismo dominio registrable). Si el front corre en otro origen, se necesita CORS con credenciales solo para `URL_FRONTEND` (ya implementado en B3).

## 6. Requisitos no funcionales relevantes para el backend (ER)

- Rendimiento (3.4, 3.7 g): consultas de un estudiante o de un psicólogo en menos de 2 s; sincronización de un curso de hasta 60 estudiantes en menos de 10 s; creación del caso por solicitud en menos de 3 s; informe en menos de 5 s; carga pico sin superar el doble de esos valores; 200 usuarios concurrentes y 100 terminales.
- Capacidad (3.4.1 c): al menos 2000 estudiantes, cursos de hasta 60, más de 50 docentes, 2 a 3 psicólogos y 20 a 30 jefes.
- Interfaz de correo (Tabla 1): procesamiento y envío al servicio externo en menos de 5 s.
- Interfaz de sincronización (Tabla 2): conexión y resultado en menos de 5 s. Rangos: `id_estudiante` alfanumérico 5 a 20; `nombre_estudiante` 2 a 150; `correo_estudiante` máximo 100; `programa_academico` 3 a 100; `codigo_asignatura` 3 a 20; `fecha_nacimiento` fecha válida anterior a la actual (D5); `calificacion_acumulada` 0.00 a 5.00 (2 decimales); `porcentaje_asistencia` 0.00 a 100.00 (2 decimales). Registros fuera de rango se omiten con advertencia. La sincronización no debe quedar registrada de forma parcial ante una interrupción (3.7 a).
- Acceso (3.5.3): el estudiante solo ve lo suyo; el docente, sus cursos y sus alertas; el Jefe, su programa sin acceso a contenidos clínicos; el psicólogo, los casos de su ruta y sus asesorías. El contenido del expediente psicológico solo lo ve el psicólogo.
- Integridad (3.5.5): registro académico con estudiante y curso válidos; alerta con registro académico; correo único por usuario.
- Seguridad (3.6.2, 3.7 c): bcrypt, OWASP Top 10, roles, transmisión cifrada, historial sin eliminación.

## 7. Diferencias conocidas entre el ER/Manual y el diseño (seguir el diseño)

- **Alertas automáticas:** ER 1.3.2, 1.4 (Alerta temprana), 3.5.1 y 3.7 f, y glosario y CU_05 del Manual hablan de generación automática. Vigente: emisión manual por el docente.
- **R07:** el ER filtra por "código de departamento" y "código de asignatura". Vigente: periodo, `idPrograma` e `idCurso`.
- **Tabla 2 del ER:** en la versión actual del ER, la lista de "Campos requeridos de entrada" no incluye `id_docente`, `nombre_docente` ni `nombre_asignatura`, pero el "Formato de datos" de la misma tabla todavía menciona `nombre_docente` e `id_docente`. Vigente: la sincronización no los usa; `codigo_asignatura` es solo la clave de enlace al curso configurado.
- **Notificaciones:** el ER (Tabla 1) lista tres tipos de correo; el diagrama de clases tiene cuatro operaciones en `ServicioNotificacion` (agrega `notificarPlanNivelacion`). Vigente: el diagrama.
- **R04:** el ER pide el "código del estudiante beneficiario"; la secuencia usa `idCaso` (el caso identifica al estudiante).
- **Consentimiento:** el ER menciona la validación de minoría de edad en R05; la confirmación del consentimiento se hace en R06 (`ControladorAtencionPsicologica`).
- **Modelo de dominio del Manual:** incluye Acudiente, Vicerrector, Consentimiento_informado y Politicas_permanencia; son del negocio, no del sistema (no crear estas entidades).
- **"Remisión":** el ER la menciona como entidad (3.5.5); no existe en el diseño. No crearla.

### Diferencias introducidas en la implementación (B2)

- **`curso.id_docente`, clave foránea oculta:** la asociación "dicta" solo es navegable desde el Docente, así que el curso no conoce a su docente. Los cursos se crean en cascada desde `guardar(docente)` y `guardar(curso)` solo actualiza un curso existente. Del mismo modo, `caso_riesgo.id_jefe`, `plan_nivelacion.id_jefe` y `cita.id_psicologo` son claves foráneas que el dominio no expone y que deriva el adaptador.
- **Clases marcadoras `Modelo*`:** TypeORM resuelve la herencia de tabla única de `Persona` y `OrigenRiesgo` por la cadena de prototipos del `target`; por eso existen clases vacías de persistencia (`ModeloPersona`, `ModeloEstudiante`, `ModeloAlerta`…) en `persistencia/esquemas`. No son entidades de dominio.
- **GRANT explícito por tabla:** cada migración otorga a `detecta_app` solo `SELECT`, `INSERT` y `UPDATE` sobre sus tablas; no se usan permisos por defecto (`ALTER DEFAULT PRIVILEGES`), para que la tabla `migraciones_typeorm` quede sin permisos para la aplicación.
- **Asociaciones que no se borran:** sin permiso `DELETE`, las filas de las asociaciones del plan ("refuerza") y del informe ("resume") nunca se eliminan; si un plan deja de reforzar un curso, la fila queda.

### Diferencias introducidas en la implementación (B3)

| Tipo | Elemento |
|---|---|
| Métodos | `ServicioAutenticacion.solicitarActivacion`, `activarCuenta` y `emitirEnlaceActivacion`; `ControladorAcceso.solicitarActivacion`, `activarCuenta` y `consultarSesion` |
| Contrato y adaptador | `RepositorioCredenciales` y `RepositorioPersistenteCredenciales` |
| Dependencia | `ServicioAutenticacion → ProveedorCorreo` |
| Rutas | Las 4 de `/acceso`, más **`GET /acceso/sesion`** |
| Cadena de acción | `listarCasosPendiente` (sd_CUD04) frente al método `listarCasosPendientes()` del diagrama de clases |
| Piezas de NestJS (Manual 4.1.1.5) | `GuardSesion`; los decoradores `@Publico()` y `@UsuarioSesion()`; `ModuloAcceso` y `ModuloIntegracion`; `configurarAplicacion` |
| Adaptador provisional | `ProveedorCorreoSinEnvio`, hasta B5 (reemplazado por `ProveedorCorreoExterno`) |
| Otros | `hashContrasenas` (envoltorio de bcrypt), el comando `datos-iniciales` y la tabla `token_activacion` |

### Diferencias introducidas en la implementación (B4)

| Tipo | Elemento |
|---|---|
| Contrato y adaptador | `UnidadTrabajo` y `UnidadTrabajoPersistente`: transacciones definidas por el servicio (Manual 4.1.1.4), con bloqueo exclusivo |
| Métodos | `ConectorBDInstitucional.omisionesUltimaLectura()` y el tipo `OmisionesLectura` (desglose por causa); `ServicioSincronizacion.obtenerUltimoResultado()` (el diagrama devuelve solo `Integer`) |
| Regla de persistencia | `guardar(persona)` no cambia `contrasena_hash` de una fila existente (solo lo cambia `RepositorioCredenciales`) y anula los tokens de activación pendientes si cambia el correo |
| Piezas de NestJS y de persistencia | `ModuloSincronizacion`, `ProgramadorSincronizacion` (tarea nocturna) y `AccesoDatos` |
| Comando | `npm run sincronizar [-- --curso <idCurso>]` |
| Ruta | `POST /sincronizacion` con `Authorization: Bearer <SINCRONIZACION_SECRETO>`: 404 si no hay secreto configurado, 401 si es erróneo, 409 si hay otra sincronización en curso, 503 por error de conexión |
| Texto nuevo | El 409 responde "Ya hay una sincronización en curso; intente más tarde." (no viene del ER) |
| Datos iniciales | Cursos y asignación docente–curso en `datos:iniciales` |

### Diferencias introducidas en la implementación (B5)

| Tipo | Elemento |
|---|---|
| Firma | `notificarCita(cita, destinatario)` en lugar de `notificarCita(cita)`: según el ER (Tabla 1), el destinatario depende del evento (estudiante, psicólogo o jefe de departamento), y `Cita` no conoce su caso |
| Modo sin envío | `CORREO_MODO=desactivado` y `ProveedorCorreoDesactivado`: avisa al arrancar, no envía y no registra contenido; prohibido con `NODE_ENV=production` |
| Configuración | Validación de las variables `CORREO_*` al arrancar: sin configuración SMTP la aplicación no arranca |
| Comando | `npm run correo:prueba -- <destino>` |
| Errores | `ErrorEnvioCorreo` y `sanear`: solo códigos técnicos, sin el mensaje ni la respuesta del servidor |
| Piezas de NestJS | `ModuloNotificacion`, `CONFIGURACION_NOTIFICACION` y `MENSAJES_TABLA_1` |
| Plantillas | Plantillas HTML (`plantillas-correo.ts`), con los valores dinámicos escapados y sin contenido confidencial |
| Adaptador | Parámetro `ca` de `ProveedorCorreoExterno` (solo pruebas); `onModuleDestroy` cierra el pool |
| Comportamiento de B3 | `solicitarActivacion` no espera el envío; `ServicioAutenticacion.onApplicationShutdown()` espera los envíos pendientes |

### Diferencias introducidas en la implementación (B6)

| Tipo | Elemento |
|---|---|
| Método | `RepositorioCasoRiesgo.listarEstadosPorOrigen(idsOrigen)`: estado del caso de cada origen en una sola consulta (D27) |
| Contrato | `RepositoriosTransaccionales` ampliado con `alertas`, `solicitudes` y `casos`: el origen y su caso se guardan en una transacción, primero el origen (D7) |
| Servicio | `ServicioNotificacion` registra los envíos en curso, los espera en `onApplicationShutdown()` y sus promesas nunca se rechazan; los controladores lanzan los correos después del commit sin esperarlos |
| Adaptador | Criterio `idEstudiante` en `listar` del adaptador de registros académicos (D21), sin cambiar el contrato |
| Pieza de NestJS | `ModuloAlertasSolicitudes` |
| Soporte de controladores | `respuestas.ts` (DTOs, `estadoAtencion` y `conPersistencia`: errores de la base de datos como 503 sin datos) y `validacion-entrada.ts` |
| Rutas | `GET /alertas/cursos/:idCurso`, `GET /alertas/emitidas?periodo=`, `POST /alertas`, `GET /consulta/registros?periodo=`, `GET /consulta/alertas?periodo=`, `GET /consulta/solicitudes`, `POST /solicitudes`; códigos 400, 403, 503 y 201; un recurso inexistente responde 403 como uno ajeno |
| Campos de respuesta | Fecha y curso en las alertas del estudiante (sin el docente); `estadoAtencion` en las alertas del docente y `estado` en las solicitudes (D27); `codigo` = `idOrigen` (D28) |
| Flujo | `radicarSolicitud` usa el estudiante ya cargado por la sesión (con `buscarPorId`) en lugar de una segunda búsqueda |
| Flujo | El jefe y los psicólogos destinatarios se buscan dentro de la transacción, no después del commit |
| Textos nuevos (no vienen del ER) | "No se encontró una matrícula activa asociada a su cuenta." (403); "El texto excede la longitud permitida." (400); "La solicitud no es válida." (400); "Indique el periodo académico." (400) |

### Diferencias introducidas en la implementación (B7)

| Tipo | Elemento |
|---|---|
| Entidad (única modificación de dominio autorizada) | `Cita.reprogramar(fechaHora, modalidad)`: el diagrama recibe solo `fechaHora`; R06 pide también la modalidad |
| Servicio | `ControlAcceso.puedeVerContenidoConfidencial` ampliado para el Jefe (D18) |
| Método | `RepositorioCasoRiesgo.buscarParaPrograma(idCaso, idPrograma)`: excluye en SQL las solicitudes psicosociales |
| Método | `RepositorioCasoRiesgo.listarEstadosPorOrigen` devuelve estado y canalización (`EstadoCasoDeOrigen`, D27 ajustada) |
| Contrato | `RepositoriosTransaccionales` con `citas` y `asesorias` |
| Contrato | `OpcionesUnidadTrabajo.bloqueos` (con espera, `pg_advisory_xact_lock` en el espacio de claves 7, `lock_timeout` de 5 s, primero el caso y después la agenda) y `BloqueoAgotadoError` |
| Esquema | Migración `TrazabilidadCaso`: `fecha_canalizacion`, `fecha_consentimiento` e `id_psicologo_consentimiento`, que fija el adaptador (`trazarCaso`); el dominio no los expone |
| Rutas | Detalles `GET /casos/:idCaso` y `GET /atencion/casos/:idCaso`, con los permisos `listarCasosPendiente` y `listarCasosPsicologo` |
| Parámetro | Campo opcional `reorientar` en `evaluarPertinencia` (solo con `pertinente = false`) |
| Servicio | `notificarCita(cita, destinatario, requiereConsentimiento)` y la línea de consentimiento en `plantillaCita` |
| Respuestas | 409 de `registrarResultado` con `requiereConsentimiento` y `pregunta`; `aviso` en `programarCita` y `programarSeguimiento` |
| Piezas de NestJS y soporte | `ModuloCasosAtencion`, `respuestas-casos.ts`, `regla()` (reglas del dominio como 409) y `RELOJ` exportado desde `ModuloAcceso` |
| Flujo | `reprogramarCita` ubica el caso entre los casos del psicólogo, porque la `Cita` no conoce su caso |
| Flujo | `ControladorPertinencia.programarCita` solo opera sobre casos `EN_EVALUACION`; las citas siguientes van por `programarSeguimiento`. Códigos: canalizar y evaluar 200; citas y resultado 201 |
| Textos nuevos (no vienen del ER) | "Caso canalizado a la ruta académica"; "El programa del estudiante no tiene Jefe de Departamento configurado."; "El estudiante no requiere consentimiento informado."; "La fecha de la cita debe ser posterior a la actual."; "Otra sesión está modificando este caso. Intente de nuevo."; "El caso ya fue evaluado."; en el correo, "Antes de la cita debe presentar el consentimiento informado firmado por su acudiente." |
| Textos transcritos | sd_CUD04 y sd_CUD06; el 503 de sd_CUD06, "Error al registrar la información del expediente", lo transcribió Ivan porque la imagen del diagrama está cortada |
| Textos reutilizados | "Error al consultar la información" (CUD01) en las lecturas de B7; "La solicitud no es válida." (B6) en entradas inválidas y en la reprogramación idéntica; mensajes del dominio (B1): "Registre la justificación" (400 en `evaluarPertinencia`), "La cita ya está cerrada" y el de estado terminal (409) |

### Diferencias introducidas en la implementación (B8)

| Tipo | Elemento |
|---|---|
| Contrato | `RepositorioInformeRiesgo` (el diagrama usa `Repositorio<InformeRiesgo>`) con `guardarConAutor(informe, idPrograma, autor)` y `buscarProgramaDelInforme(idInforme)`; el segundo hace falta para que el Jefe solo exporte los informes de su programa |
| Esquema | Migración `AutoriaInforme`: `id_programa` (NOT NULL, con relleno de filas existentes), `id_jefe` e `id_psicologo` (CHECK `ck_informe_un_autor`: exactamente uno). Es la asociación "genera" del diagrama de entidades; la entidad no la expone |
| Servicio | `GeneradorInformeRiesgo.generar(periodo, idPrograma, curso, autor)`: recibe el autor, devuelve null sin datos (no guarda) y filtra en memoria por asignatura |
| Tipo y soporte | Tipo `Archivo` (`nombre`, `tipoContenido`, `contenido`) y generador de PDF propio `pdf-minimo.ts` (PDF 1.4, Helvetica WinAnsi, sin dependencias) |
| Contrato | `RepositoriosTransaccionales` con `planes`; el texto del bloqueo vencido es configurable en `conPersistencia` |
| Piezas de NestJS y rutas | `ModuloPlanesInformes`; `POST /planes`, `POST /planes/:idPlan/finalizacion`, `POST /informes`, `GET /informes/:idInforme/pdf`; `InformeDto` con las definiciones de cada total |
| Flujo | Los cursos del plan se validan contra los registros académicos del estudiante; la lista no puede estar vacía; el cronograma es opcional |
| Prueba de B2 modificada | `repositorios.int-spec.ts › InformeRiesgo` guarda con `guardarConAutor`, porque un informe nuevo exige programa y autor |
| Textos transcritos | sd_CUD04 (CUD05): "Faltan los datos del estudiante tutor", "Plan de nivelación registrado"; sd_CUD10: "No hay datos para el periodo seleccionado", "Error al generar el informe" |
| Textos nuevos (no vienen del ER) | "Error al registrar el plan de nivelación"; "Otra sesión está modificando este plan. Intente de nuevo."; en el PDF, el título, las etiquetas de los totales, las tres definiciones (alertas, casos cerrados o archivados, planes contados aparte) y la nota de que solo contiene datos agregados |
| Textos reutilizados | "La solicitud no es válida.", "Indique el periodo académico." y "El texto excede la longitud permitida." (B6); "Otra sesión está modificando este caso. Intente de nuevo." (B7, bloqueo del caso en `estructurarPlan`); del dominio (B1), como 409: "El plan de nivelación requiere un caso con ruta ACADEMICA" y "El plan de nivelación ya está finalizado" |

### Diferencias introducidas en la implementación (B9)

| Tipo | Elemento |
|---|---|
| Esquema | Tabla `evento_caso` (migración `EventosCaso`, con reversión): un evento por acción, con `id_caso`, `id_actor`, `tipo` y `ocurrido_en` (`now()` de PostgreSQL), más `id_plan`, `id_cita` y las fechas y modalidades anterior y nueva según el tipo (CHECKs por tipo). Tipos: `DICTAMEN_APROBADO`, `DICTAMEN_ARCHIVADO`, `DICTAMEN_REORIENTADO`, `CITA_PROGRAMADA`, `CITA_REPROGRAMADA`, `CASO_CERRADO`, `PLAN_FINALIZADO`. Sin contenido confidencial |
| Permisos | Excepción a la convención del §7 (B2): `detecta_app` tiene solo `SELECT` e `INSERT` sobre `evento_caso`, sin `UPDATE`, `DELETE` ni `TRUNCATE` (registro inmutable) |
| Contrato y adaptador | `RegistroEventosCaso.registrar(evento)` con el tipo `TipoEventoCaso`, en `aplicacion/contratos`; adaptador `RegistroPersistenteEventosCaso` |
| Contrato | `RepositoriosTransaccionales.eventos`: el evento se inserta en la misma transacción que la acción (`evaluarPertinencia`, `programarCita`, `programarSeguimiento`, `reprogramarCita`, `cerrarCaso` y `finalizarPlan`) |
| Limitador (D15) | `LimitadorPeticiones`, `LIMITADORES` y `limites-peticiones.ts`, en memoria y con reloj inyectado: 429 con `Retry-After` en `POST /acceso/iniciar-sesion` y `POST /acceso/solicitar-activacion` |
| Cabeceras | `cabeceras-seguridad.ts` (sin helmet): `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Content-Security-Policy` en todas las respuestas; HSTS solo con `COOKIE_SEGURA=true`; `Cache-Control: no-store` en las respuestas con sesión, en todo `/acceso/*` y en el PDF |
| Arranque | `hilos-libuv.ts`, primera importación de `main.ts`: fija `UV_THREADPOOL_SIZE` desde el entorno o `.env` antes de que libuv cree sus hilos |
| Variables nuevas (opcionales) | `UV_THREADPOOL_SIZE` (1 a 128; 4 por defecto), `BD_DETECTA_POOL_MAX` (1 a 50; 10 por defecto) y `BD_DETECTA_CONEXION_ESPERA_MS` (1000 a 60 000; 10 000 por defecto: al vencer la espera de una conexión, la ruta responde 503 con su texto) |
| Persistencia | El cargador de grafos ya no lanza consultas en paralelo dentro de una transacción; `trazarCaso` hace un solo UPDATE |
| Texto nuevo (aprobado en el plan de B9) | "Demasiados intentos. Intente de nuevo más tarde." (429) |
| Pruebas de carga | `npm run carga:preparar` y `npm run carga` (bases `detecta_carga` e `institucional_carga`, fuera de `npm test`); M4 marca la corrida INVÁLIDA si hay respuestas con un estado no esperado o faltan los datos del escenario |

**Notas para F1 (B9):**
- **429:** `POST /acceso/iniciar-sesion` y `POST /acceso/solicitar-activacion` pueden responder 429 con el texto "Demasiados intentos. Intente de nuevo más tarde." y la cabecera `Retry-After` (segundos). El front debe mostrar el texto y no reintentar antes de ese plazo.
- **Cabeceras:** la API envía `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` y `X-Frame-Options: DENY`, pensadas para respuestas JSON y el PDF. No cargar la API en un `iframe`. Con `COOKIE_SEGURA=true` se envía HSTS.
- **`no-store`:** las respuestas con sesión, las de `/acceso/*` y el PDF no se guardan en caché (equipos compartidos de los laboratorios). El front no debe depender de la caché del navegador para esas respuestas.
- **503 por espera de conexión:** si la base no entrega una conexión en `BD_DETECTA_CONEXION_ESPERA_MS`, la ruta responde 503 con su texto habitual (por ejemplo, "Error al consultar la información"); tratarlo igual que los demás 503.

### Decisiones y textos del frontend (F0)

| Tipo | Elemento |
|---|---|
| Pila | React 19.3.1, React Router 8.5.2, Vite 8.3.8, Vitest 5.1.1 con Testing Library y jsdom; oxlint y Prettier con las mismas versiones del backend. **TypeScript 6.0.3**, fijado igual que el backend (no la 7.0.2, la reescritura nativa). Sin librerías de formularios, estilos ni cliente HTTP: `fetch` propio y CSS con variables y CSS Modules |
| Estructura | `front/src/paginas/{acceso, estudiante, docente, jefe-departamento, psicologo}`, `componentes` y `servicios-api` (diagrama de paquetes, Manual 4.1.2) |
| Rutas del front | `/` (redirige según la sesión), `/iniciar-sesion`, `/solicitar-activacion`, `/activar` (la fija el enlace del backend), `/estudiante`, `/docente`, `/jefe-departamento` y `/psicologo`. La redirección por rol es solo ayuda de usabilidad: la autorización está en el backend |
| Proxy de desarrollo | Vite redirige `/api/*` al backend y quita el prefijo, para que el navegador vea un solo sitio (cookie `SameSite=Strict`). **Solo en desarrollo:** cómo se sirve el front en el despliegue se decide en F5 |
| Sesión en el navegador | El front nunca lee ni guarda el token (cookie `HttpOnly`). La sesión vive en memoria y se consulta con `GET /acceso/sesion` al arrancar, sin mensaje y sin bucles. **Sin almacenamiento persistente:** nada en `localStorage`, `sessionStorage` ni cachés |
| Enlace de activación | El token se lee del fragmento (`/activar#token=…`), se borra de la URL de inmediato (`history.replaceState`) y se envía en el cuerpo. Tras una activación fallida se conserva **solo en memoria** para reintentar; al activarse la cuenta se borra |
| Recuperación de contraseña | Por D6: la misma pantalla `/solicitar-activacion` sirve para activar y para recuperar; sin pantalla aparte |
| Errores uniformes | 401, 400, 409 y 429: texto del backend; 401 en una petición protegida lleva a `/iniciar-sesion` con el aviso una sola vez; 403: siempre el texto de F0; 503: texto de la ruta o el genérico; 500: el genérico; 429: botón deshabilitado hasta que vence `Retry-After` |
| Textos nuevos (provisionales, sujetos a la revisión de usabilidad de F5) | Rótulos: "Correo electrónico", "Contraseña", "Nueva contraseña", "Iniciar sesión", "Cerrar sesión", "Solicitar enlace", "Fijar contraseña". Títulos de pantalla: "Iniciar sesión", "Solicitar enlace de acceso", "Fijar contraseña" (también como texto de los enlaces entre pantallas). Títulos de los espacios: "Estudiante", "Docente", "Jefe de Departamento de Programa", "Psicólogo". Errores: "No tiene permiso para realizar esta acción." (403), "No fue posible completar la operación. Intente de nuevo más tarde." (500 y 503 genérico), "No fue posible conectar con el servidor. Verifique su conexión e intente de nuevo." (red). Confirmación: "Contraseña fijada. Ya puede iniciar sesión." (una vez, `role="status"`). Título de la pestaña: "<pantalla> · DETECTA" |
| Textos reutilizados del backend | "Sesión no válida o caducada", "Correo o contraseña incorrectos", "El enlace no es válido o ya caducó", "Demasiados intentos. Intente de nuevo más tarde.", "Si el correo está registrado, recibirá un enlace para fijar su contraseña.", "La contraseña debe tener al menos 12 caracteres" y el `message` de cualquier 400, 409 o 503 |
| Accesibilidad base | `lang="es"`, etiquetas asociadas a cada campo, errores con `role="alert"` y confirmaciones con `role="status"`, foco visible, controles de al menos 44 px de alto, diseño primero para celular sin desborde horizontal a 360 px |

**Nota para F0:** el enlace de activación lleva el token en el fragmento de la URL (`/activar#token=…`), que el navegador nunca envía al servidor ni en la cabecera `Referer`. La página de activación del front debe leer el token del fragmento y enviarlo en el **cuerpo** del `POST /acceso/activar` (`{ token, contrasena }`), nunca en la URL.

### Decisiones y textos del frontend (F1)

| Tipo | Elemento |
|---|---|
| Rutas del front | `/estudiante` (consulta académica, CUD01), `/estudiante/solicitudes` (CUD01 2.b) y `/estudiante/solicitudes/nueva` (CUD02), con una navegación de tres enlaces. Reemplazan el espacio vacío de F0 |
| Periodo | Filtro de la consulta de registros y de alertas (CUD01), texto libre de hasta 20 caracteres. La solicitud (CUD02) no lleva periodo |
| Formato | `es-CO`: notas y asistencia con dos decimales y coma ("3,45", "87,50 %"); fechas "19/11/2026" en hora de Bogotá |
| 403 de matrícula | Excepción a la regla de F0, solo en `POST /solicitudes`: se muestra el texto del backend "No se encontró una matrícula activa asociada a su cuenta." (D21). Cualquier otro 403 de esa ruta, y todos los de las demás, siguen con el texto de F0. **Criterio (aprobado en el cierre de F1):** el front compara el `message` del 403 con el texto aprobado de D21 (`TEXTO_SIN_MATRICULA` en `front/src/servicios-api/estudiante.ts`); si coincide lo muestra, si no muestra el texto de F0. No se compara con «Forbidden» (ajuste E). Si el backend cambia ese texto, el front debe cambiar con él |
| Doble envío de la solicitud | Botón deshabilitado durante el envío y reemplazo del formulario por el comprobante. Tras un error de red se compara `GET /consulta/solicitudes` de antes y de después del envío (código nuevo con el mismo tipo, motivo y disponibilidad): si aparece, se muestra su comprobante; si no, el error de red de F0. Si alguna de las dos consultas falla, el envío no se bloquea y se muestra el texto de resultado incierto. Límite: dos solicitudes idénticas enviadas a la vez desde dos pestañas se verían como una |
| **Diferencia para la v4** | La copia del formulario ante un 503 (R02, situaciones anormales; Manual CUD02 6.a; nota de sd_CUD02 «La GUI conserva los datos diligenciados (R02)») vive **solo en la memoria del componente**: se pierde al recargar, al cerrar la pestaña, al salir de la pantalla y tras un 401. Nada en `localStorage` ni `sessionStorage` |
| Textos transcritos | "Información no disponible" (sd_CUD01 4.a; también cuando falta la fecha de sincronización), "Describa el motivo de la solicitud" (sd_CUD02; Manual CUD02 5.a), "No fue posible registrar la solicitud. Intente de nuevo" (sd_CUD02), "Error al consultar la información" (sd_CUD01). Valores: "Académico" y "Psicosocial" (R02, Manual CUD02), "Pendiente" y "Atendida" (Manual CUD01 2.b), "Bajo", "Medio" y "Alto" (este plan, F2) |
| Textos reutilizados del backend | "Indique el periodo académico." (también antes de enviar), "El texto excede la longitud permitida.", "La solicitud no es válida.", "No se encontró una matrícula activa asociada a su cuenta." |
| Aviso de R02 (paso 3), **aprobado** (provisional, sujeto a la revisión de usabilidad de F5) | Base: ER R02 paso 3 («El sistema informa al Estudiante, antes del envío, quién podrá ver su solicitud según la categoría seleccionada: el Psicólogo si es psicosocial, o el Jefe de Departamento de programa si es académica.»), Manual CUD02 paso 3 («El sistema informa al Estudiante quién podrá ver su solicitud según el tipo de apoyo seleccionado: el Psicólogo si es psicosocial, o el Jefe de Departamento de Programa si es académica.») y requisito especial del Manual CUD02 sobre la canalización (el destinatario es el Jefe de Departamento de Programa «mientras el caso no sea canalizado a la ruta psicológica»). Textos: académico "Podrá ver su solicitud el Jefe de Departamento de Programa." con el complemento de remisión "Si lo considera necesario, podrá remitirla a psicología; en ese caso dejará de verla y la verá el Psicólogo."; psicosocial "Podrá ver su solicitud el Psicólogo.". Aparece al elegir el tipo y antes de poder enviar |
| Textos nuevos (provisionales, sujetos a la revisión de usabilidad de F5) | Títulos y enlaces: "Consulta académica", "Mis solicitudes", "Solicitar acompañamiento". Rótulos: "Periodo académico", "Consultar", "Asignatura", "Nota", "Asistencia", "Última sincronización", "Alertas", "Fecha", "Nivel de riesgo", "Descripción", "Tipo de apoyo", "Motivo", "Disponibilidad horaria" (en la lista) y "Disponibilidad horaria (opcional)" (en el formulario), "Estado", "Código de rastreo", "Enviar solicitud". Ayuda del periodo: "Por ejemplo: 2026-2". Vacíos: "No hay alertas registradas para este periodo.", "Aún no ha registrado solicitudes.". ER 1.3.4: "El acompañamiento de DETECTA es una asesoría educativa y no una intervención clínica.". Comprobante (ER 3.3.3): "Su solicitud fue recibida." con el código de rastreo, la fecha y el estado, sin datos de identidad. Resultado incierto: "No se pudo confirmar si su solicitud fue registrada. Revise «Mis solicitudes» antes de enviarla de nuevo." |
| Datos de prueba en la base `detecta` (desarrollo) | La prueba manual de F1 dejó **2 alertas** (Ingeniería de Software I, MEDIO; Cálculo Integral, ALTO; periodo 2026-2; docente de ejemplo sobre `estudiante1@ejemplo.invalid`) y **4 solicitudes** (2 académicas y 2 psicosociales del mismo estudiante), cada una con su caso de riesgo. Las descripciones y motivos llevan el prefijo «Prueba manual F1». Aparecerán en las bandejas de F2 a F4. **No son datos de demostración** |

### Decisiones y textos del frontend (F2)

| Tipo | Elemento |
|---|---|
| Rutas del front | `/docente` (consulta de curso por código), `/docente/cursos/:idCurso` (listado con el estado de la sincronización y el formulario de alerta en la misma pantalla) y `/docente/alertas` (alertas emitidas). Navegación de dos enlaces; «Consulta de curso» queda activa también en `/docente/cursos/…`. Reemplazan el espacio vacío de F0 |
| Selección del curso | Campo «Código del curso», máximo 36 caracteres, sin autocompletado; sin código el botón «Consultar» queda deshabilitado (D37) |
| Última sincronización (ER 3.3.5) | Fecha y hora reales del curso en es-CO, hora de Bogotá en 24 horas ("dd/mm/aaaa hh:mm"), sin texto que afirme o niegue que la información esté actualizada; si el curso nunca se sincronizó, "Información no disponible" |
| 403 con texto de los diagramas | Extensión del criterio de F1, solo en `GET /alertas/cursos/:idCurso` ("El curso no está asignado al docente", sd_CUD01) y `POST /alertas` ("El estudiante no pertenece a un curso asignado", sd_CUD03): se compara el `message` con el texto aprobado (`TEXTO_CURSO_AJENO` y `TEXTO_REGISTRO_AJENO` en `front/src/servicios-api/docente.ts`). Cualquier otro 403, en cualquier ruta, sigue con el texto de F0. Si el backend cambia esos textos, el front debe cambiar con ellos |
| Formulario de alerta | Muestra el estudiante y el registro que sustenta la alerta (curso, nota y asistencia). Nivel de riesgo sin valor por defecto; justificación de hasta 2000 caracteres con contador ("n / 2000") y sin autocompletado; campos vacíos bloquean el envío con el texto de sd_CUD03. Al abrirse, el foco pasa al formulario; al cerrarlo ("Cancelar") o tras la confirmación vuelve al botón de la fila que lo abrió |
| Doble envío de la alerta | Como la solicitud de F1: botón deshabilitado durante el envío y conciliación con `GET /alertas/emitidas` del periodo del curso (alerta nueva del mismo curso y estudiante, con el mismo nivel y la misma descripción) |
| Visibilidad (D18, D19) | El docente ve el nombre, la nota y la asistencia de los estudiantes de sus cursos y sus propias alertas con el estado "Pendiente" o "Atendida". Ninguna de sus rutas trae solicitudes, motivos ni contenido psicosocial. El `estudiante.id` y los demás identificadores de la base no se muestran ni quedan en el DOM (los ids del DOM son por posición) |
| Tablas | `th` con `scope="col"` y `scope="row"`; a menos de 48rem cada fila se apila como tarjeta con el rótulo de la columna, sin desborde a 360 px |
| Textos transcritos | "Información no disponible" (sd_CUD01 4.a), "Error al consultar la información" (sd_CUD01), "El curso no está asignado al docente" (sd_CUD01), "El estudiante no pertenece a un curso asignado" (sd_CUD03), "Complete el nivel de riesgo y la justificación" (sd_CUD03 6.a; R01), "Alerta emitida y remitida al Jefe de Departamento" (sd_CUD03), "Error al registrar la alerta" (sd_CUD03). Valores "Bajo", "Medio" y "Alto" (Manual CUD03) y "Pendiente" y "Atendida" (D27). Rótulo "Justificación" (R01 paso 4; sd_CUD03) |
| Textos reutilizados del backend | "Indique el periodo académico.", "El texto excede la longitud permitida.", "La solicitud no es válida.", "Sesión no válida o caducada" |
| Textos nuevos (provisionales, sujetos a la revisión de usabilidad de F5) | Navegación y títulos: "Consulta de curso", "Alertas emitidas". Rótulos: "Código del curso", "Consultar", "Curso", "Periodo académico", "Última sincronización", "Estudiante", "Nota", "Asistencia", "Emitir alerta", "Nivel de riesgo", "Estado de atención", "Fecha", "Cancelar" (aprobado como provisional en el cierre de F2). Ayuda del periodo: "Por ejemplo: 2026-2" (campo vacío, no se rellena). Vacío: "No ha emitido alertas en este periodo.". Resultado incierto: "No se pudo confirmar si la alerta fue registrada. Revise «Alertas emitidas» antes de emitirla de nuevo." |
| **Diferencias para la v4** | (1) sd_CUD03 *.b dice "Sesión caducada"; el front muestra el texto del backend, "Sesión no válida o caducada" (regla de F0). (2) La copia del formulario de alerta vive solo en la memoria del componente (como la solicitud en F1): se pierde al cerrar, al recargar, al salir o tras un 401. (3) `seleccionarCurso(idCurso)` se hace escribiendo el código del curso, no eligiéndolo de una lista (D37). (4) El ER 3.3.5 pide mostrar "si la información mostrada está actualizada" y no define umbral: el front muestra solo la fecha y la hora reales de la última sincronización |
| Datos de prueba en la base `detecta` (desarrollo) | La prueba manual de F2 dejó **2 alertas** del docente de ejemplo en Cálculo Integral (2026-2), cada una con su caso de riesgo: Pedro Tres, MEDIO, "Prueba manual F2: inasistencias en las últimas semanas."; Laura Gomez Ruiz, ALTO, "Prueba manual F2: guardada pero sin respuesta (conciliación).". Se suman a las de F1; aparecerán en las bandejas de F3 y F4. **No son datos de demostración** |
| Pendientes para F5 (cierre de F2) | (1) Contador de caracteres en el motivo y la disponibilidad de F1: no se toca ahora; se evalúa en F5. (2) Tabla apilada en celular (`display: block` por debajo de 48rem): se revisa en la auditoría de accesibilidad de F5 por la semántica de tabla en lectores de pantalla |

### Decisiones y textos del frontend (F3)

| Tipo | Elemento |
|---|---|
| Rutas del front | `/jefe-departamento` (bandeja de casos pendientes), `/jefe-departamento/casos/:idCaso` (detalle, canalización y plan de nivelación en la misma vista) y `/jefe-departamento/informes` (informes de riesgo). Navegación de dos enlaces; «Casos pendientes» queda activo también en el detalle |
| Bandeja (CUD04) | Tabla con estudiante, fecha, origen y nivel de riesgo; las solicitudes no traen nivel y la celda muestra un guion. Cada fila tiene el botón «Detalle del caso», que navega por código: ni el id del caso ni el del estudiante quedan en el DOM |
| Detalle (CUD04, nota de sd_CUD04) | Origen, nivel de riesgo y datos del origen: de una alerta, el curso, el periodo, la justificación, la nota y la asistencia; de una solicitud académica, el tipo de apoyo y, solo si el backend los envía, el motivo y la disponibilidad (D18). Antecedentes académicos en tabla; sin registros, "Información no disponible" |
| Canalización (ajuste A) | La ruta no tiene valor por defecto y «Canalizar caso» queda deshabilitado hasta elegirla; sin diálogo de confirmación. Tras un error de red se concilia releyendo el caso (`ruta` igual a la elegida); si no se puede confirmar, se muestra el error de red y reintentar es seguro porque el backend responde "El caso ya fue canalizado". Tras canalizar a psicología se pinta el caso de la respuesta, que ya no trae el motivo |
| Plan de nivelación (CUD05; respuesta 1) | Solo aparece tras canalizar a la ruta académica en la misma vista, y allí se registra y se finaliza (D38). Cursos: los del estudiante con registro académico, tomados de `antecedentes[].curso.idCurso` del detalle, sin repetir. Nombre del tutor (150), código del tutor (20) y cronograma opcional (2000, con contador). Sin tutor, "Faltan los datos del estudiante tutor"; sin cursos, "Seleccione al menos un curso"; en ambos casos no se envía |
| Resultado incierto del plan (decisión de Ivan) | Solo el error de red sin respuesta es incierto: se muestra el texto provisional y «Registrar plan» queda deshabilitado mientras el Jefe siga en la vista, sin «Finalizar plan» (no hay `idPlan`). Un 400, 409 o 503 es un fallo cierto: se muestra su texto y lo escrito se conserva para reintentar. El bloqueo vive solo en memoria |
| Informes (CUD10; respuesta 2; ajustes C y E) | Periodo (20) y «Código del curso» (36, como D37); sin código el botón queda deshabilitado y sin periodo se muestra "Indique el periodo académico.". El Jefe no envía `idPrograma`. Mientras se genera: "Generando el informe…" y botón deshabilitado. 200: el mensaje del backend; 201: curso, periodo, fecha, los tres totales con su definición (del backend) y el resumen. «Exportar PDF» descarga `informe-riesgo-<periodo>-<curso>.pdf`: el nombre no se toma de `Content-Disposition`, porque el CORS del backend no expone esa cabecera; la URL del Blob se libera tras el clic y nada se guarda en el navegador |
| Visibilidad (D18, D19) | El Jefe ve los casos sin canalizar de su programa y, de una solicitud académica, el motivo y la disponibilidad solo si llegan en la respuesta. Nunca ve solicitudes psicosociales (el backend las excluye), el expediente ni la justificación del dictamen. Los identificadores de la base no se muestran ni quedan en el DOM |
| Módulos compartidos nuevos | `componentes/tabla.module.css` (la tabla apilada de F2, movida sin cambios), `descargar` en `servicios-api/cliente.ts`, `componentes/guardar-archivo.ts`, los límites `tutorNombre`, `tutorCodigo` y `cronograma`, y `ROTULOS_COMUNES` en `componentes/etiquetas.ts` (rótulos que repetían el Docente y el Estudiante). IU_Informes queda en `paginas/jefe-departamento` y se extrae a `componentes/` en F4 (respuesta 4) |
| Textos transcritos | "El caso ya fue canalizado", "Caso remitido a psicología", "Error al registrar la canalización" (sd_CUD04); "Faltan los datos del estudiante tutor", "Plan de nivelación registrado" (sd_CUD04, CUD05); "No hay datos para el periodo seleccionado", "Error al generar el informe" (sd_CUD10); "Origen" y "Antecedentes académicos" (nota de sd_CUD04); "Alerta académica temprana" y "Solicitud de acompañamiento" (nombres de CUD03 y CUD02) |
| Textos reutilizados del backend | "Caso canalizado a la ruta académica", "El programa del estudiante no tiene Jefe de Departamento configurado.", "Error al registrar el plan de nivelación", "Otra sesión está modificando este caso. Intente de nuevo.", "Otra sesión está modificando este plan. Intente de nuevo.", "Indique el periodo académico.", "Error al consultar la información", "La solicitud no es válida.", y las definiciones de los totales del informe |
| Textos nuevos (provisionales, sujetos a la revisión de usabilidad de F5) | Títulos: "Casos pendientes", "Detalle del caso", "Informes de riesgo". Rótulos y botones: "Canalizar caso", "Ruta académica", "Ruta psicológica", "Plan de nivelación", "Nombre del tutor", "Código del tutor", "Cronograma (opcional)", "Cursos del plan", "Registrar plan", "Finalizar plan", "Generar informe", "Exportar PDF", "Total de alertas", "Total de casos", "Total de planes", "Activo", "Finalizado". Mensajes: "No hay casos pendientes", "Seleccione al menos un curso", "No se pudo confirmar si el plan fue registrado. Para evitar un plan duplicado, no puede registrarse de nuevo desde esta pantalla.". Aprobados después del plan, también provisionales: "Generando el informe…" (ajuste E) y el guion "—" de la celda sin nivel |
| Desviaciones menores | (1) `ROTULOS_COMUNES` adelanta, para los rótulos que usa el Jefe, el tercer ítem de adelgazamiento que F1b dejó para F5. (2) La prueba de rutas de F0 ahora espera el título "Casos pendientes" para el Jefe y busca la llamada de inicio de sesión por su URL, porque la bandeja consulta al montar |
| Prueba manual reducida (19/11/2026) | Backend real con `CORREO_MODO=desactivado` solo como variable del proceso (sin tocar `.env`), Vite y Chrome sin interfaz (playwright-cli). (1) Canalizar a la ruta académica, registrar y finalizar el plan: OK. (2) Canalizar a psicología: OK; el motivo de la solicitud deja de mostrarse. (3) Informe de 2026-2 de Cálculo Integral (`CALC-201`) y PDF: OK; la descarga llega como `informe-riesgo-2026-2-CALC-201.pdf` y el archivo se abre. (4) Ningún identificador de la base en el DOM y `localStorage` y `sessionStorage` en 0 en todos los pasos; solo aparece el código del curso que escribe el Jefe en el campo del informe (como D37). (5) Consulta del curso y alertas emitidas de F2 a 360 y 1280 px: posición, tamaño y estilos de los 48 y 46 elementos de `main` idénticos a los de `main` |
| Cuentas de ejemplo | Las contraseñas del docente y del Jefe de ejemplo no se conocían: se emitió un enlace nuevo con `npm run datos:iniciales -- --enlace <correo>` y se canjeó por `POST /acceso/activar`, con correo desactivado. Las contraseñas nuevas solo están fuera del repositorio |
| Datos de prueba en la base `detecta` (desarrollo) | La prueba manual de F3 dejó: la alerta de F2 de Pedro Tres (Cálculo Integral) canalizada a la ruta académica (`EN_NIVELACION`) con **1 plan** finalizado (tutor «Prueba manual F3 Tutor», código «T-F3-01», curso Cálculo Integral) y su evento `PLAN_FINALIZADO`; la solicitud académica de F1 de Luis Gomez Torres («me cuesta seguir el ritmo de Cálculo Integral») canalizada a psicología (`PENDIENTE`, ruta `PSICOLOGICA`), que queda para F4; y **1 informe** de 2026-2 de Cálculo Integral. **No son datos de demostración** |

### Implementación parcial del frontend (F4a)

| Tipo | Registro |
|---|---|
| Estado | F4a implementada y aprobada; verificación parcial contra el backend real completada. La verificación visual en navegador sigue pendiente. Pasaron **226 pruebas** de frontend. |
| Desvío temporal respecto a `sd_CUD06` | La programación de la primera cita se difiere a F4b. Un caso aprobado sigue apareciendo en la bandeja como asignado para que F4b continúe desde ahí. |
| Limitaciones | Ante un error de red no conciliable, el dictamen queda bloqueado contra reintentos en esa vista; el bloqueo es más conservador de lo necesario porque el backend permite repetir una aprobación en `EN_EVALUACION` (200). Revisar en F5b. El backend devuelve el mismo mensaje con barra para archivar y reorientar («Caso archivado / reorientado»); la interfaz presenta textos provisionales distintos según el estado conciliado. |
| Traspaso obligatorio a F4b (R06) | Para un menor sin consentimiento confirmado, registrar el resultado de la asesoría o de la sesión atendida debe quedar bloqueado: ER R06, situación 2; Manual CUD08, precondición y extensión 1.a. |
| Textos nuevos provisionales para revisar en F5 | Títulos: «Remisiones», «Expediente de atención psicológica». Navegación, secciones y campos: «Sin asignar», «Asignadas a mí», «Ver expediente», «Origen», «Ruta de atención», «Antecedentes académicos», «Citas», «Resultado de asesoría», «Modalidad», «Tipo de asesoría», «Observaciones», «Acuerdos», «Asistencia», «Requiere seguimiento», «Presenta riesgo crítico», «Consentimiento informado confirmado», «Psicólogo asignado», «Evaluar pertinencia», «Justificación», «Confirmar consentimiento». Valores legibles: estados del caso y de citas, modalidad, tipo de asesoría, origen y ruta psicológica. Mensajes/validación: «Registre la justificación», «No hay remisiones para mostrar.», «Información no disponible», «No se pudo confirmar el resultado. Para evitar repetir el dictamen, no puede enviarse de nuevo desde esta pantalla.», «El consentimiento informado está confirmado.», «Caso archivado» y «Caso reorientado». |
| Cuenta de Psicólogo | No hay una cuenta ni credenciales de Psicólogo documentadas en el repositorio. La cuenta de prueba se activó para esta verificación; contraseña aleatoria fuera del repositorio en `C:\Users\nedus\AppData\Local\Temp\detecta-f4a-psicologo-credencial.txt` (no registrar aquí su contenido). |
| Verificación real 1 | **OK.** Inicio de sesión con rol Psicólogo y lectura inicial de `GET /atencion/casos`: 3 remisiones, el caso académico canalizado en F3 y dos solicitudes psicosociales F1; todas pendientes, sin asignar y en ruta psicológica, sin casos fuera de ese conjunto. |
| Verificación real 2 | **OK.** `GET /atencion/casos/:idCaso` para un caso visible devolvió `{caso, antecedentes}`. La revisión de detalle de la interfaz queda para F5b. |
| Verificación real 3 | **OK.** Caso inexistente con sesión: 403. |
| Verificación real 4 | **Hallazgo.** Repetir dictamen de archivo: 409, «El caso ya fue evaluado.». Repetir aprobación en `EN_EVALUACION`: 200 (el backend permite la segunda aprobación). |
| Verificación real 5 | **OK.** Justificación vacía: 400, «Registre la justificación»; el caso F3 se aprobó (200, «Caso aprobado. Programe la cita») y una solicitud psicosocial F1 se archivó (200, «Caso archivado / reorientado»). La interfaz no vuelve a ofrecer el formulario tras aprobar: el DTO trae `psicologo` asignado y la vista presenta el estado. |
| Verificación real 6 | **Parcial.** Ninguno de los tres DTO indicó `requiereConsentimiento`; el 409 para un adulto fue «El estudiante no requiere consentimiento informado.». No se verificó con datos reales un menor sin consentimiento ni se forzó la confirmación; queda pendiente para F4b. |
| Verificación real 7 | **OK.** Ruta protegida sin cookie: 401. |
| Verificación real 8 | **No verificable sin navegador.** Identificadores en el DOM y vista a 360 y 1280 px; pasa a F5b. |
| Pendientes F5b | Revisar detalle de expediente (caso 2), DOM y visual a 360/1280 px (caso 8), y el bloqueo conservador del reintento de dictamen tras error de red. Recorrido visual del Psicólogo: sección «Citas» vacía sin mensaje; fechas con dos formatos; tarjetas de citas anidadas; botón «Ver expediente» pegado a las líneas en la bandeja; contraste del botón deshabilitado «Evaluar pertinencia»; formularios de cita, resultado y consentimiento sin revisión visual. |
| Casos que quedaron en `detecta` | El caso académico F3 quedó en `EN_EVALUACION`, aprobado y asignado al Psicólogo para F4b; una de las dos solicitudes psicosociales F1 quedó `ARCHIVADO` y asignada; la otra continúa `PENDIENTE` y sin asignar. Las dos justificaciones escritas llevan el prefijo «Prueba manual F4a». |

### F4b: atención psicológica

- Estado final: implementada. Backend real verificado con `CORREO_MODO=desactivado` confirmado en el registro; 236 pruebas de frontend pasan (28 archivos). Lint, typecheck, format:check y build pasan. La suite completa pasó con `--maxWorkers=2`; corridas normales bajo carga dieron timeouts/race aislados en pruebas preexistentes de sesión/solicitud, que pasaron aisladas o en la corrida limitada. El servidor se detuvo y no quedan procesos `node`.
- Alcance: primera cita, reprogramación, resultado, seguimiento, cierre y consentimiento en el expediente del Psicólogo. El resultado queda bloqueado en la interfaz si el DTO indica que el estudiante requiere consentimiento y este no está confirmado (ER R06, situación 2; Manual CUD08, precondición y extensión 1.a). El DTO sí expone `requiereConsentimiento` y `consentimientoConfirmado`; no se infiere edad.
- Zona horaria: los campos de cita representan `America/Bogota` (UTC-5), se envían como ISO 8601 con `-05:00` y se muestran en esa zona. El backend rechaza fechas no futuras con «La fecha de la cita debe ser posterior a la actual.»
- Cierre: el DTO distingue asesoría completa mediante `citas[].asesoria.observaciones`; la regla de dominio solo exige observaciones no vacías en la última cita. El botón se habilita con ese dato.
- B10: `GET /programas` devuelve solo `[{idPrograma, nombre}]`, ordenado con locale español para el selector de informes del Psicólogo (CUD10). La sesión estándar da 401; la matriz autoriza `listarProgramas` solo a PSICOLOGO, con 403 para el Jefe y otros roles. La respuesta autenticada incluye `Cache-Control: no-store`. No requiere cambios de esquema ni migración.
- B10, persistencia: `listar(new Map())` selecciona ids de `programa` y reconstruye únicamente filas de `programa`, sin cargar relaciones. La prueba de integración se conecta como `detecta_app` a `detecta_pruebas` y confirma `SELECT` real sobre `programa`.
- Informes del Psicólogo: IU_Informes se extrajo a `front/src/componentes/`, conservando solo el uso del Jefe; su integración visual para el Psicólogo queda para F4c. Las pruebas actuales del Jefe pasan sin cambios.
- D17/D20/D23: no afectan el alcance; F4b no cambia asignaciones de jefes, sincronización institucional ni asignación docente-curso.
- Verificación real, adulto: la bandeja y expediente devolvieron el caso aprobado en F4a; primera cita 201, reprogramación 200, resultado 201, seguimiento 201, resultado de seguimiento 201 y cierre 200. Fecha pasada: 400 con el mensaje del backend indicado arriba.
- Pruebas de componente: el formulario envía la fecha de Bogotá con offset `-05:00` y muestra el error HTTP de fecha pasada literalmente; el bloqueo R06 y la ausencia de identificadores/almacenamiento también tienen cobertura.
- Conteo de pruebas nuevas de F4b sobre la base F4a (226): `front/src/pruebas/psicologo-atencion.test.tsx`, 9; cubre zona/fecha pasada, flujo cita-reprogramación-resultado-seguimiento-cierre con todos los campos del resultado, el estado que habilita cierre, bloqueo de reintento para cada una de las cinco escrituras y texto del 409 R06. `front/src/pruebas/psicologo-remisiones.test.tsx`, 1; bloquea resultado sin consentimiento y comprueba que no se envíe, que identificadores no aparezcan en DOM/atributos y que `localStorage`/`sessionStorage` sigan vacíos. Total: 10 nuevas, 236. La prueba R06 dio rojo contra el expediente anterior a F4b y verde con el bloqueo implementado. Se reforzó además la prueba de consentimiento existente para exigir la nueva lectura del expediente tras el POST sin cuerpo; su reintento continúa permitido e inocuo.
- Verificación real, menor: ISOF-101 contenía dos menores con correo `@ejemplo.invalid`; se activó uno sin sincronizar ni recargar datos. Solicitud 201, aprobación 200, cita 201, resultado preconsentimiento 409 «No se puede registrar la atención sin consentimiento», consentimiento ficticio de desarrollo 200, resultado 201, seguimiento 201, resultado de seguimiento 201 y cierre 200.
- Casos que quedaron en `detecta`: el caso adulto de F4a y la solicitud psicosocial «Prueba manual F4b» quedaron `CERRADO`; se conservaron la solicitud F1 pendiente y el caso F4a archivado. Todos los textos escritos en la prueba llevan el prefijo requerido.
- Credencial de menor: `%TEMP%\detecta-f4b-menor-credencial.txt` (solo ruta; contenido secreto, fuera del repositorio).
- Textos provisionales de F4b para revisar en F5: «Atención y seguimiento», «Las fechas se interpretan en America/Bogota (UTC-5).», «Programar primera cita», «Fecha y hora (Bogotá)», «Nueva fecha y hora (Bogotá)», «Programar cita», «Reprogramar», «Registrar resultado», «Confirme el consentimiento informado antes de registrar asesoría o resultado.», «Requiere seguimiento», «Presenta riesgo crítico», «Programar seguimiento», «Cerrar caso» y «No se pudo confirmar la operación. Consulte de nuevo el expediente antes de reintentar.» Etiquetas de valores: `ORIENTACION` → «Orientación», `SEGUIMIENTO` → «Seguimiento»; asistencia `true` → «Asistió», `false` → «No asistió».
- Verificación con navegador: DOM de identificadores cubierto en prueba de componente; visual a 360 y 1280 px no verificada en navegador y pasa a F5b.

### Despliegue en línea (F6): nodos reales

No hay diagrama de despliegue en `docs/diagramas/`. Estos son los nodos reales de la demostración pública (aprobados en el plan de F6, opción A):

| Nodo | Plataforma | Contenido y conexión |
|---|---|---|
| Cliente | Navegador | HTTPS solo hacia `https://detecta-web.onrender.com` |
| Servidor web | Render Static Site `detecta-web` (gratuito, CDN) | Front compilado (React). Reescritura `/api/*` → `https://detecta-api.onrender.com/*` (sin el prefijo) y `/*` → `/index.html` |
| Servidor de aplicación | Render Web Service `detecta-api` (gratuito, Ohio; 0,1 CPU y 512 MB) | NestJS sobre Node 26.13.1 (`npm run start:prod`) |
| Servidor de base de datos | Neon, proyecto `Detecta` (gratuito, `aws-us-east-2`, Ohio), PostgreSQL 18 | `detecta_entrega` (`detecta_app` y `detecta_migrador`) e `institucional_entrega` (`institucional_lector`), mismo modelo de permisos de F5a. Conexión directa, TLS `verify-full` (`PGSSLMODE`) |
| Servicio externo de correo | Brevo, `smtp-relay.brevo.com:2525` (STARTTLS, TLS 1.3) | `ProveedorCorreo` por SMTP. Render gratis bloquea 25, 465 y 587 |

**Diferencias con el ER y el Manual:**

- **Disponibilidad (ER 1.3.1):** el ER supone un servicio disponible las 24 horas. En la demostración, el plan gratuito apaga el servicio web tras 15 minutos sin tráfico; despertarlo tarda alrededor de un minuto. Neon suspende el cómputo tras 5 minutos de inactividad. Se mitiga con un monitor externo sobre `GET /api/acceso/sesion`, ruta que no consulta la base.
- **Cupo por IP del limitador:** detrás del proxy de Render, todas las peticiones llegan con la IP de socket `::1`, así que los cupos por IP de D15 son globales (D39).
- **Correo:** el puerto pasa de 587 a 2525 solo por configuración (`CORREO_SMTP_PUERTO`). El código no cambia.
- **Cambio operativo en `back/`:** `GET /salud` (`ControladorSalud`, registrado en `AppModule`) es la única ruta nueva. No está en los diagramas porque no es funcional: la necesita el monitor externo, que exige una respuesta 2xx (cron-job.org desactiva el trabajo tras unos 25 fallos seguidos) y no debe despertar Neon. No hay otros cambios de comportamiento en `back/` ni en `front/`. F6 agrega además configuración (`render.yaml`, `demo/.env.remoto.example`) y scripts.

## 8. Decisiones (ante una decisión abierta, el agente debe detenerse y preguntar)

| # | Tema | Fase límite | Estado |
|---|---|---|---|
| D5 | Fuente de `Estudiante.fechaNacimiento` | Antes de B4 | Resuelta. `fecha_nacimiento` viene de la base institucional (ER Tabla 2) |
| D6 | Credenciales de las cuentas y origen de los usuarios | Antes de B3 | Resuelta (corregida). Solo los estudiantes se sincronizan; docentes, jefes, psicólogos, programas, cursos y asignación docente–curso se cargan con el script de datos iniciales. Las cuentas se activan por enlace con token de un solo uso enviado al correo institucional (sirve para todas las cuentas y para recuperar la contraseña) |
| D7 | Docente obligatorio en un caso de riesgo (ER 3.5.5) | Antes de B2 | Resuelta (16/11/2026). Sin docente obligatorio; un caso tiene motivo, estudiante y exactamente un origen (Alerta o SolicitudAcompanamiento); prevalece sobre el ER 3.5.5 |
| D8 | Reglas sin definir y fuera de los diagramas: tiempo máximo de canalización, si se notifica al estudiante la canalización, máximo de reprogramaciones de una cita | No implementar | Sin decisión |
| D9 | Duración de una cita; hoy el cruce es solo misma fecha y hora exactas | B7 | Aceptada como limitación (18/11/2026). El cruce es por fecha y hora exactas |
| D10 | Contenido de `PlanNivelacion.descripcion` | B8 | Aceptada como limitación (18/11/2026). Queda vacía: ni R04 ni `estructurarPlan` la reciben |
| D11 | Si `REORIENTADO` cuenta como caso finalizado en el informe | B8 | Resuelta (18/11/2026). No cuenta: `estaFinalizado()` solo es verdadero para `CERRADO` y `ARCHIVADO` (R07: "cerrados o archivados") |
| D12 | Periodo de un caso o plan | Antes de B7 | Resuelta (17/11/2026). El periodo de un caso o plan es el del curso; las solicitudes voluntarias quedan fuera de los informes por periodo; `listarPorPeriodo` de casos devuelve solo cerrados o archivados |
| D13 | Carga de usuarios y configuración que no llegan por sincronización | B3 y B4 | Resuelta. Script de datos iniciales con archivo JSON: programas y usuarios en B3; cursos y asignación docente–curso en B4 |
| D14 | Duración de la sesión | B3 | Resuelta. Sesión de 60 minutos fijos |
| D15 | Bloqueo por intentos fallidos | Antes de B9 | Resuelta (19/11/2026). Sin bloqueo de cuenta; limitador en memoria con 429, "Demasiados intentos. Intente de nuevo más tarde." y `Retry-After`. Inicio de sesión: solo cuentan los fallos, en ventanas de 15 min; 10 por (IP, correo normalizado) y 100 por IP; un inicio exitoso reinicia el par. Solicitud de activación: cuentan todas las peticiones, en ventanas de 1 h, antes de consultar el correo; 30 por IP y 3 por correo. Memoria acotada (50 000 claves), sin `X-Forwarded-For`. `UV_THREADPOOL_SIZE` opcional (4 por defecto) |
| D16 | Vida del token de activación y límite de solicitudes | B3 | Resuelta. Token de activación de 30 minutos y 3 solicitudes por cuenta y por hora |
| D17 | Cambio de jefe de un programa (requiere el concepto de cuenta inactiva) | Posterior | Abierta (sin cambios en B9) |
| D18 | Qué ve el Jefe de una solicitud académica confidencial; el ER 3.7 c y el perfil del Estudiante se contradecían | B7 | Resuelta (18/11/2026; ER y Manual ajustados). El Jefe ve el motivo, la disponibilidad y la identidad de una solicitud académica de su programa mientras no se canalice a psicología; nunca ve una solicitud psicosocial (excluida en la consulta) ni el expediente. Una solicitud académica canalizada a psicología la ve el psicólogo con su motivo (regla D19) |
| D19 | Contenido confidencial | B3 | Resuelta. Psicólogo con ruta `PSICOLOGICA` y caso sin asignar o asignado a él |
| D20 | Lo que deja de venir en la fuente institucional (estudiantes o registros) se conserva sin marca, porque no hay `DELETE` | Posterior | Abierta (sin cambios en B9) |
| D21 | Qué es "matrícula activa" al radicar una solicitud (R02): la Tabla 2 no trae un campo de estado de matrícula y la vista solo expone matrículas activas | B6 | Resuelta (18/11/2026). Matrícula activa = al menos un `RegistroAcademico` del estudiante, sin periodo vigente. Limitación: quien deja de venir en la fuente conserva sus registros (D20) |
| D22 | `codigo_asignatura = Curso.idCurso`: un curso por asignatura; un periodo nuevo exige cursos nuevos con códigos nuevos | B4 | Aceptada como limitación |
| D23 | Reasignar un curso a otro docente en `datos:iniciales`: hoy falla con un mensaje explicativo | Posterior | Abierta (sin cambios en B9) |
| D24 | Entrega de correos sin cola ni reintentos | B5 | Aceptada como limitación. Un fallo se registra como "Error de envío" y no se reintenta; la entrega no está garantizada (ER Tabla 1) |
| D25 | Avisos de `npm audit` en `picomatch` y `glob` (dependencias anteriores a B5) | B9 | Registrada (19/11/2026). Producción: 0 avisos al 19/11/2026 (`npm audit --omit=dev`: "found 0 vulnerabilities"); desarrollo: 18 moderadas en jest, `glob` y `minimatch`, sin efecto en el servidor. No se tocan dependencias |
| D26 | Quién recibe el correo de cita según el evento: estudiante, psicólogo o jefe | B7 | Resuelta (18/11/2026). Solo el estudiante (R05 paso 6, R06 paso 8); con un menor sin consentimiento, el correo incluye una línea genérica sobre el consentimiento del acudiente, sin mencionar psicología |
| D27 | Estado que ven el estudiante y el docente de una solicitud o alerta: la regla de B1 marca el origen ATENDIDO al generar el caso, y CUD02 dice que la solicitud queda pendiente | B6, ajustada en B7 | Resuelta (18/11/2026). Se deriva del caso al leer: `ATENDIDA` si el caso salió de PENDIENTE o tiene `fecha_canalizacion`; `PENDIENTE` en otro caso. Una solicitud psicosocial nace con ruta psicológica pero sin canalización: sigue PENDIENTE hasta que un psicólogo la toma. Sin ruta ni avance; el estado guardado del origen no cambia |
| D28 | Código único de rastreo de la solicitud (R02) | B6 | Aceptada como limitación. Es `idOrigen` (UUID) |
| D29 | Estado del caso académico con el plan de nivelación | B8 | Aceptada como limitación (18/11/2026). El caso queda `EN_NIVELACION` al registrar y al finalizar el plan, así que los casos de la ruta académica no entran en `totalCasos`; los planes se cuentan aparte (`totalPlanes`). Se admiten varios planes por caso |
| D30 | Formato del archivo exportado del informe (R07: "formato estándar"; sd_CUD10 y Manual CUD10: PDF) | B8 | Resuelta (18/11/2026). PDF con un generador propio mínimo, sin dependencias |
| D31 | El limitador es en memoria y por instancia | B9 | Aceptada como limitación (19/11/2026). Se pierde al reiniciar y no se comparte entre instancias |
| D32 | Sin revocación de JWT | B9 | Aceptada como limitación (19/11/2026). Sesión fija de 60 min (D14); cerrar sesión solo borra la cookie |
| D33 | Estado compartido del conector (`omisionesUltimaLectura` y el último resultado) | B9 | Aceptada como limitación (19/11/2026). Es seguro solo mientras el bloqueo impida dos sincronizaciones a la vez |
| D34 | Consulta del registro de trazabilidad | B9 | Aceptada como limitación (19/11/2026). No hay consulta ni endpoint de auditoría: `evento_caso` solo se verifica en la base de datos |
| D35 | Inicios de sesión simultáneos masivos | B9 | Aceptada como limitación (19/11/2026). Con bcrypt de costo 12, los hashes se encolan en los hilos de libuv: rinden unos (hilos ÷ 0,4 s) inicios por segundo. Medido: 20 simultáneos con p95 de 1,8 a 2,7 s con 4 hilos; 200 simultáneos, p95 de 21 a 32 s (informativo). Subir `UV_THREADPOOL_SIZE` según los núcleos del servidor |
| D36 | Pool de conexiones agotado antes del guard de sesión | B9 | Aceptada como limitación (19/11/2026). Si la base no entrega una conexión al guard dentro de `BD_DETECTA_CONEXION_ESPERA_MS`, la respuesta es un 500 genérico (`{"statusCode":500,"message":"Internal server error"}`, verificado: sin mensajes de `pg`, trazas ni nombres de tablas), dentro del plazo y sin colgarse. Solo las rutas responden 503 con su texto |
| D37 | Lista de los cursos del docente | F5 o cierre del proyecto | Abierta (19/11/2026). No hay ruta que liste los cursos del docente: sd_CUD01 y sd_CUD03 parten de `seleccionarCurso(idCurso)` sin operación que dé la lista. En F2 el docente escribe el «Código del curso» (máximo 36 caracteres; R01, entradas: «código de asignatura»; D22). La usabilidad mejoraría con una ruta de lectura que liste los cursos del docente; se evalúa en F5 o al cierre del proyecto. No se tocó el backend |
| D38 | Volver a un caso en nivelación o a un plan | F5 o cierre del proyecto | Cerrada (23/11/2026, F5b). Se agregó `GET /casos/ruta-academica` (Jefe): casos del programa que dirige con ruta `ACADEMICA`, del más reciente al más antiguo, con la misma forma que `GET /casos/pendientes` y la exclusión D18 en la consulta. `GET /casos/:idCaso` agrega `planes: [{idPlan, estado, tutorNombre, tutorCodigo, cursos, cronograma}]`, del más antiguo al más reciente (sin `idCaso` ni `fecha`); vacío sin plan, en ruta psicológica o sin ruta. En el front, el enlace «En ruta académica» lleva al detalle, que muestra los planes del caso y el formulario solo si ningún plan está activo (D29). Sigue sin clave de idempotencia: tras un error de red al registrar, el reintento queda bloqueado en la vista (`front/src/paginas/jefe-departamento/plan-nivelacion.tsx`, línea 147, `setBloqueado(true)`; el botón se deshabilita en la línea 224), pero al volver al caso la lectura de los planes dice si quedó. Ver §15 |
| D39 | Cupo por IP del limitador detrás del proxy de Render | F6 | Aceptada como limitación (22/11/2026, J2). En el despliegue el backend ve todas las peticiones con la IP de socket `::1`, y `X-Forwarded-For` no se usa (D15). Los cupos por IP pasan a ser globales: 100 fallos de inicio de sesión cada 15 min y 30 solicitudes de activación por hora, para todos los usuarios juntos. Los cupos por (IP, correo) y por correo siguen funcionando. Sin `trust proxy` ni cambios de backend |
| D40 | Tiempo de inicio de sesión en el despliegue gratuito (ER 3.4: consultas en menos de 2 s) | F6 | Aceptada como limitación (22/11/2026, J7). Con bcrypt de costo 12 (D35) y 0,1 CPU del plan gratuito de Render, `POST /api/acceso/iniciar-sesion` midió de 1,71 a 2,52 s, y por la pantalla de 1,74 a 2,18 s. Las mediciones son desde Colombia contra Ohio, en caliente; en algunos casos se supera la meta. No se cambia el costo ni se contrata otro plan |

**Notas de B9 sobre el §8:**
- **ECONNRESET aislado:** apareció una sola vez, bajo sobrecarga extrema (escenario de estrés, pool 30, 200 usuarios con 5 s de reflexión y el event loop bloqueado hasta 3,4 s). El intento dedicado de reproducirlo (cliente keep-alive y pausa de 5,1 s) no lo reprodujo, así que `keepAliveTimeout` no se cambió. Causa probable, no confirmada: una carrera de keep-alive.
- **Excepción de permisos:** `evento_caso` es la única tabla sin `UPDATE` para `detecta_app` (ver §7, B9). La prueba de permisos la comprueba aparte.
- **Textos nuevos:** solo el del 429, aprobado en el plan de B9.
- **No se hizo por falta de evidencia** (con datos realistas y las metas del ER):
  - paginación de las bandejas: la bandeja del Jefe tarda 57 ms sola;
  - R6 (filtro del informe en SQL): el informe tiene un p95 de 278 ms, por debajo del umbral de 2,5 s;
  - R8 (b), guard con consultas propias: p50 de 25 ms o menos, por debajo de 50 ms;
  - R1, R3 y R5: un curso sincroniza en menos de 1 s (meta 10 s); `listarPorRol(PSICOLOGO)` tarda menos de 100 ms y `reprogramarCita`, 110 ms.
- **Pool de conexiones:** el barrido realista (10, 20 y 30) fue inválido: M4 corrió sin los datos del escenario y sus respuestas fueron 401. El pool se mantiene en 10 por falta de evidencia a favor de otro valor (sección 11).
- **Evidencia de rendimiento válida:** los registros anteriores a la remedición final no guardaban los estados HTTP, así que la remedición final (sección 11) es la evidencia válida.
- **Fallo e2e intermitente de la sub-etapa 1:** quedó sin identificar (una prueba falló una vez, 68 de 69, y el registro solo guardó los totales). No se reprodujo en 20 corridas: 10 en `048b019` (69/69) y 10 en `aaa6b45` (73/73).

## 9. Antecedentes (versiones anteriores, NO vigentes)

- Diagrama de entidades PlantUML original con `Acudiente`, y la versión previa de la Vista de Escenarios (rechazada por parecer un diagrama de requisitos).
- `Repositorio<T>` genérico único, sin repositorios especializados.
- Generación automática de alertas; el rol Coordinador; el Acudiente como actor o clase del sistema.
- Lista de requisitos R01 a R11 / F1 a F11 del SRS inicial.
- Stack propuesto en un prototipo (React, Tailwind, Supabase, SendGrid): reemplazado por React, NestJS y PostgreSQL.
- Diagrama de componentes en capas previo (no vigente; el nuevo no está disponible).
- Casos de uso del negocio anteriores (versiones de 7 y 9) y las estructuras previas del proceso general (de 3 procesos; con Acudiente y 6 carriles).

## 10. Lo que NO está disponible (no asumir)

Diagrama de componentes vigente, descripciones de los casos de uso de diseño (tablas CUD01 a CUD10), diseño de pantallas (GUI), modelo de datos relacional independiente del diagrama de entidades, versiones del ER y del Manual posteriores a las v1.4 y v1.2.

## 11. Mediciones finales de B9 (rendimiento)

**Las cifras locales no equivalen a producción.** Son de un portátil y varían entre corridas.

- **Máquina:** AMD Ryzen 5 3500U, 8 núcleos lógicos, 10 GB de RAM, Windows 11, Node v26.13.1, PostgreSQL 18 en Docker local. `UV_THREADPOOL_SIZE` = 4 y pool de 10 conexiones (valores por defecto).
- **Escenario realista (ER 3.4.1 c):** 25 programas de unos 80 estudiantes (2000), 75 docentes, 25 jefes y 3 psicólogos; 6000 alertas y casos, 1000 planes y 400 casos psicológicos con cita.
- **Supuestos de M4 (no son cifras del ER):** 200 usuarios virtuales (150 estudiantes, 30 docentes, 17 jefes y 3 psicólogos), cada uno con una petición y luego un tiempo de reflexión de unos 10 s, o de unos 5 s en la variante exigente (±50 %), durante 60 s, con `sincronizarTodo` en curso.
- **Validez:** cada corrida cuenta los estados HTTP y es INVÁLIDA si hay respuestas no esperadas. La corrida final fue VÁLIDA: 100 % de 2xx y sin errores de red. Los registros anteriores a esta remedición no guardaban los estados HTTP: la remedición final es la evidencia válida.
- **Estado del equipo:** la remedición se hizo con el equipo **no en reposo**: carga de CPU de 28 a 49 % (29 a 49 % antes y 28 a 46 % después), con Discord abierto.
- **El estrés no se remidió tras la sub-etapa 4:** sus cifras son anteriores a la sub-etapa 4 y a la trazabilidad.

**Escenario realista, 19/11/2026 (M4 con 3 repeticiones; el resto con 1 corrida; M5 con 10 peticiones):**

| Id | Medición | Resultado | Meta del ER |
|---|---|---|---|
| M4 | 200 usuarios, reflexión de 10 s: p95 de todas las peticiones (mediana y rango) | 841 ms (284–1034) | < 2 s ✔ |
| M4 | 200 usuarios, reflexión de 5 s (supuesto propio del escenario, no del ER) | Mediana 3206 ms (rango 2294–5232) | Supera los 2 s normales; dentro de los 4 s de pico en la mediana, pero no en el máximo |
| M4 | Una petición de cada tipo, sin concurrencia (p95) | 32 a 65 ms (bandeja del Jefe 57 ms, 48 kB) | ✔ |
| M4 | Ráfaga de 200 a la vez (informativa) | p95 6424 ms | — |
| M1 | Inicio de sesión, bcrypt de costo 12: en serie / 20 a la vez (p95) | 702 ms / 2697 ms | — (D35) |
| M2 | Guard por petición: estudiante / docente / jefe / psicólogo (consultas; p50) | 2 / 6 / 2 / 3; 9 / 25 / 6 / 17 ms | < 50 ms ✔ |
| M3 | Sincronizar un curso de 53 estudiantes | 790 ms | < 10 s ✔ |
| M3 | `sincronizarTodo` con 2000 estudiantes: primera / segunda vez (solo se mide) | 32,9 s / 44,5 s | — |
| M5 | Informe de una asignatura (p95; 40 consultas) | 278 ms | < 5 s ✔ |
| M6 | `listarPorRol(PSICOLOGO)` (p95) | 92 ms | — |
| M7 | Casos del psicólogo / reprogramar (p95) | 36 ms / 110 ms | — |
| M8 | Consultas de `guardar(caso)`: sin citas / con una cita | 4 / 6 | — |

**Escenario de estrés (1 programa de 2040 estudiantes, un psicólogo con 300 casos), antes de la sub-etapa 4 y de la trazabilidad, 3 repeticiones:**

| Id | Resultado |
|---|---|
| M4 | Reflexión de 10 s / 5 s: p95 de 9360 / 8209 ms; ráfaga: 9240 ms; bandeja del Jefe sola: 403 ms (2030 casos, 974 kB) |
| M1 | 20 a la vez: p95 de 1980 ms |
| M5 | p95 de 1301 ms |
| M7 | Casos del psicólogo / reprogramar: p95 de 161 / 276 ms |

**Pool de conexiones:** se mantiene en 10 por falta de evidencia a favor de otro valor. El barrido realista (10, 20 y 30, una repetición) fue inválido: M4 corrió sin los datos del escenario y sus respuestas fueron 401. En estrés, el control salió fuera de rango y no hubo mejora demostrable.

## 12. F4c: informes del Psicólogo (aprobada)

- Rama `fase/f4c-psicologo-informes`, creada desde `main` (`ac3fea8`). Reutiliza `IU_Informes` y la plantilla existente del Psicólogo; `GET /programas` alimenta el selector, que muestra nombres y mantiene los identificadores fuera del DOM. El Psicólogo envía `{periodo, idPrograma, idCurso}`; el cuerpo del Jefe permanece `{periodo, idCurso}`.
- El backend inspeccionado devuelve 200 con `No hay datos para el periodo seleccionado` si curso/programa/período no producen datos; curso inexistente devuelve 400. Se añadieron pruebas de componente para el caso sin datos, sin poder confirmarlo mediante HTTP real.
- Front verificado: 246 pruebas (29 archivos), typecheck, lint, format:check y build correctos. La suite nueva cubre programas vacíos/errores, selección sin IDs en DOM/almacenamiento, cuerpo Psicólogo, respuesta sin datos y descarga PDF simulada. Las 6 pruebas existentes del Jefe siguen sin cambios.
- Primer intento de verificación real (superado por el siguiente punto): el proceso arrancó con `CORREO_MODO=desactivado` confirmado en su registro, pero no abrió el puerto 3000; por seguridad no se enviaron peticiones. No se generó ningún informe. Quedan sin confirmar el caso curso ajeno a programa, el cuerpo real del Psicólogo, el PDF no vacío y la comparación real del cuerpo del Jefe. La verificación visual queda no verificada en navegador y pasa a F5b.
- Textos provisionales aprobados para revisar en F5: `Informes de riesgo` y `No hay programas disponibles.`; `Programa` y `Seleccione un programa` ya estaban aprobados.
- Verificación real y visual (20/11/2026, Claude Code, en la rama; backend recompilado con `CORREO_MODO=desactivado` como variable del proceso, confirmado en su registro; cuenta del Psicólogo y del Jefe):
  1. `GET /programas`: 200, ordenado por nombre, cada elemento solo con `{idPrograma, nombre}`.
  2. `POST /informes`: 201 con `idPrograma` en el cuerpo enviado. Se generó un único informe: CALC-201, 2026-2, programa SIS.
  3. Curso de otro programa: 200 con «No hay datos para el periodo seleccionado»; la interfaz muestra ese texto.
  4. PDF: 200, `application/pdf`, empieza con `%PDF-`.
  5. Navegador a 1280 y 360 px: sin desbordes; el selector usa valores por posición; ningún `idPrograma` en el DOM ni en atributos; `localStorage` y `sessionStorage` en 0; la descarga del PDF funciona.
  6. El cuerpo del Jefe sigue sin `idPrograma`.
  7. Observación: el Jefe de un programa puede descargar el informe de su programa generado por el Psicólogo, porque la regla filtra por programa y no por autor (a verificar contra el ER).
- Pendiente para F5b: inconsistencia de anchos entre el aviso «sin datos» del Jefe (ancho completo), el formulario (720 px) y la tarjeta del Psicólogo (848 px); botón deshabilitado con poco contraste; favicon pendiente.

## 13. F5a: entorno de demostración, arranque local y estabilidad de pruebas

- Rama `fase/f5a-entorno-demo-estabilidad`, creada desde `main` (`8b5cfcf`). Codex inició la fase y Claude Code la retomó tras un diagnóstico de solo lectura aprobado por Ivan. Guía de uso: [`demo/README.md`](../demo/README.md).
- **Bases aisladas:** `detecta_entrega` e `institucional_entrega`, dentro de `detecta-postgres`. Los scripts solo crean, borran o modifican esas dos bases (lista blanca); `-Reiniciar` elimina y recrea únicamente esas dos.
- **Desviación del plan aprobada (decisión 1 de Ivan):** se reutilizan los roles existentes `detecta_app`, `detecta_migrador` e `institucional_lector` en lugar de crear roles propios de la demo. El modelo de permisos es el vigente: `detecta_app` sin `DELETE` ni `TRUNCATE` (lo otorgan las migraciones) e `institucional_lector` en solo lectura sobre las vistas. Los scripts no crean ni modifican roles.
- **Correo en demo (decisión 2):** variables nuevas y opcionales en `back/.env.example`:
  - `CORREO_RECHAZAR_EJEMPLO_INVALID` rechaza `@ejemplo.invalid`;
  - `CORREO_DESTINO_PERMITIDO` admite una dirección o un prefijo terminado en `*` con dominio fijo (en la demo, `detectasoportetecnico+*@gmail.com`).

  Los destinos no permitidos fallan con `DESTINATARIO_NO_PERMITIDO` antes de abrir la conexión SMTP. Fuera de la demo, el comportamiento no cambia.
- **Enlaces de activación (decisión 3):** la salida de `datos-iniciales` se guarda en `%USERPROFILE%\detecta-entrega\enlaces-activacion.txt`. Se sobrescribe en cada preparación, se borra con `-Reiniciar` y nunca se imprime ni se versiona. La activación de la demo usa el flujo real `/solicitar-activacion`.
- **Datos (decisión 4):** `institucional_entrega.csv` y su variante alternativa están en UTF-8 sin BOM y tienen 80 filas:
  - el curso ISOF-101 con 60 estudiantes y 5 menores;
  - un único alias `detectasoportetecnico+estNN@gmail.com` por estudiante;
  - los mismos casos límite de `institucional_demo`: conflicto de nombre de 2026002, valores fuera de rango y matrícula inactiva.

  Los datos iniciales usan los programas y cursos de B4, para conservar los rechazos por programa inexistente, por nombre sin tilde y por curso no configurado (QUIM-999). Las cuentas usan alias `+<rol>`.
- **SQL (decisión 5):** la Tabla 25 de `institucional_entrega` se carga con `institucional_demo.sql` (el archivo no contiene el nombre de la base), sin copia versionada. La variante de columnas ficticias tiene su propio SQL y su JSON de conector (ER 3.7 e).
- **Configuración de la demo:** `demo/.env.example` deja vacía `SINCRONIZACION_HORA_NOCTURNA`; en el guion la sincronización se lanza a mano. `scripts/validar-entorno-demo.mjs` exige todas las claves del ejemplo y que ninguna variable de la sesión las tape, porque `node --env-file` no reemplaza variables existentes y ConfigModule completaría las ausentes con `back/.env`.
- **Vitest:** `maxWorkers: 2`, `testTimeout: 10000` y `asyncUtilTimeout: 3000` en la preparación común; `jefe-informes.test.tsx` no se modificó.
- **Corregido respecto al trabajo inicial de Codex:**
  - BOM y línea vacía tras `COPY … FROM STDIN` en el SQL de entrega, que habrían hecho fallar la carga;
  - `psql -c` con `\gexec`, que no es válido;
  - correos distintos para un mismo estudiante;
  - programas y curso añadidos que anulaban los casos de rechazo de B4;
  - respaldo de enlaces borrado tras el éxito.
- **Verificación real (20/11/2026, Claude Code, autorizada por Ivan):**
  1. `preparar-demo.ps1 -Reiniciar`, código 0:
     - 5 migraciones en `detecta_entrega`;
     - 80 filas en `institucional_entrega`;
     - datos iniciales: 2 programas, 3 cuentas y 3 cursos;
     - 3 enlaces en el archivo de respaldo, que no se mostró.

     El tamaño de las demás bases y las filas de `detecta`, `institucional_demo` y `detecta_pruebas` coinciden antes y después. `detecta_app` solo tiene `SELECT`, `INSERT` y `UPDATE`; `institucional_lector` solo tiene `SELECT` sobre las dos vistas.
  2. ER 3.4: la sincronización de ISOF-101 actualizó 60 registros en **2,82 s** medidos con `Measure-Command`. La cifra incluye el arranque de Node y de NestJS; la meta es de 10 s.
  3. Sincronización de todos los cursos, en 3,10 s:
     - 67 registros actualizados;
     - omisiones: 3 por calificación o asistencia fuera de rango, 3 por identificación, 1 por fecha de nacimiento, 2 por programa y 2 por datos inconsistentes del estudiante;
     - QUIM-999 no se lee.
  4. ER 3.7 e: la variante de columnas ficticias, con su JSON de conector, da el mismo resultado en 3,01 s.
  5. `iniciar-demo.ps1` abrió los puertos 3000 y 5173 y registró «Sincronización nocturna desactivada». Dos solicitudes de activación por `/api/acceso/solicitar-activacion` (docente y `+est01`) respondieron 202 y emitieron 2 tokens, sin errores de envío en el registro. La recepción en Gmail la confirma Ivan.
  6. Cierre por PID: al detener el backend lanzado, el script cerró Vite y terminó con código 0, sin puertos ocupados.

## 14. F6: despliegue en línea

- Rama `fase/f6-despliegue`, creada desde `main` (`4544895`). Plan aprobado por Ivan con las decisiones J1 a J9. Guía de uso: [`demo/README.md`](../demo/README.md), «Despliegue en línea (F6)». Nodos reales y diferencias con el ER: §7, «Despliegue en línea (F6): nodos reales». Limitaciones: D39 y D40.
- **Enlace público:** <https://detecta-web.onrender.com>. Solo datos ficticios (CSV y JSON de F5a), sin costo. Render (`detecta-web` estático y `detecta-api` Node 26, Ohio), Neon (PostgreSQL 18, `aws-us-east-2`) y Brevo SMTP en el puerto 2525.
- **Paso 0 (prueba de concepto, retirada antes del PR):** comprobó en Render cuatro cosas:
  - Node `v26.13.1`;
  - que la reescritura `/api/*` quita el prefijo, conserva la consulta y el cuerpo, y deja pasar `Set-Cookie` y `Cookie`. En Chromium la cookie quedó en `detecta-web.onrender.com`, invisible desde JavaScript;
  - el estado 429 con `Retry-After`;
  - Brevo: el puerto 2525 negocia STARTTLS con TLS 1.3, y el 587 está bloqueado.
- **Sin cambios de comportamiento** en `back/` ni en `front/`, salvo la ruta operativa `GET /salud` (más abajo). Archivos nuevos:
  - `render.yaml` (Blueprint, 9 secretos con `sync: false`) y `demo/.env.remoto.example`;
  - `scripts/preparar-remoto.ps1` y `.mjs` (con `-Reiniciar` y `-SoloVerificar`), `scripts/sincronizar-remoto.mjs` y `scripts/preactivar-remoto.mjs`.

  Además, `validar-entorno-demo.mjs` gana el modo `--remoto` y `.gitignore` la excepción `!.env.remoto.example`.
- **TLS hacia Neon sin cambiar código:** `PGSSLMODE=verify-full`, que lee la librería `pg`; el certificado es de Let's Encrypt con raíz ISRG Root X1. Se usa la conexión **directa**, porque el pooler no admite el parámetro de arranque `default_transaction_read_only` de la conexión institucional.
- **Desviación del plan (técnica):** la imagen `postgres:18` no trae certificados raíz, y `verify-full` falló con «certificate verify failed» antes de crear nada. `psql` corre ahora en un contenedor temporal (`docker run --rm`) de la misma imagen, con las raíces de confianza de Node montadas en solo lectura. `detecta-postgres` no se modifica.
- **Respaldo de las bases:** Neon gratis no ofrece respaldos automáticos. Solo permite restaurar a un punto en el tiempo dentro de una ventana de 6 horas (1 GB de historial de cambios) y guardar una instantánea manual. La forma de volver al estado inicial es `preparar-remoto.ps1 -Reiniciar`, seguido de la sincronización y la preactivación.
- **Verificación real (22/11/2026, Claude Code, autorizada por Ivan):**
  1. `preparar-remoto.ps1`, también con `-Reiniciar` al cierre:
     - PostgreSQL 18;
     - los 3 roles sin superusuario, createdb, createrole, replicación ni bypassrls, y el lector con `default_transaction_read_only=on`;
     - `detecta_app` con SELECT e INSERT en 15 de 15 tablas, UPDATE en 14 de 15 (no en `evento_caso`), y DELETE, TRUNCATE, REFERENCES y TRIGGER en 0;
     - rechazos reales de `DELETE`, `TRUNCATE` y `UPDATE` de `evento_caso` como `detecta_app`, y de la tabla base como lector;
     - sin CONNECT cruzado entre bases;
     - 5 migraciones, 80 filas (79 visibles en la vista), 2 programas, 3 cuentas y 3 cursos.

     Las 8 bases locales conservaron su tamaño y las claves de los roles locales no cambiaron (comparación por huella md5).
  2. **Backend real:** 401 de NestJS, cabeceras de seguridad con HSTS y CORS solo para `https://detecta-web.onrender.com`. Un origen ajeno no recibe cabeceras CORS.
  3. **Sincronización:** `POST /api/sincronizacion`, HTTP 200 en 3,1 s y, tras el reinicio, en 2,7 s (meta: 10 s). 3 cursos, 67 registros actualizados y 11 omitidos, con el mismo desglose que en F5a.
  4. **Preactivación (J8):** docente, jefe, psicólogo, estudiante adulto 2026001 y estudiante menor 2026005, por el flujo real (activar 204, iniciar sesión 200 con el rol correcto). Las credenciales están solo en `%USERPROFILE%\detecta-entrega\cuentas-evaluador.txt`; nunca se imprimieron.
  5. **Inicio de sesión por la pantalla, los 5 roles:** cada uno llega a su espacio. La cookie es `HttpOnly`, `Secure` y `SameSite=Strict`, del dominio `detecta-web.onrender.com`, e invisible desde JavaScript. Tiempos en D40.
  6. **Un flujo por rol:**
     - docente: consulta de ISOF-101 y alerta de riesgo alto para 2026001;
     - estudiante adulto: ve sus registros y la alerta, y radica una solicitud académica (código de rastreo, Pendiente);
     - estudiante menor: radica una solicitud psicosocial;
     - jefe: la bandeja muestra la alerta y la solicitud académica, pero no la psicosocial (D18). Canaliza a la ruta académica y registra un plan de nivelación;
     - psicólogo: aprueba la pertinencia de la remisión del menor y programa una cita virtual. El caso queda «Citado».
  7. **Correo (confirmado por Ivan en Gmail):** la activación de `+est04` llegó con un enlace a `https://detecta-web.onrender.com/activar`. La cita de `+est05` llegó con la línea genérica sobre el consentimiento del acudiente, sin mencionar psicología (D26).
  8. **Arranque en frío:** tras 17,5 min sin tráfico, la primera petición tardó 22,7 s; la siguiente, 0,42 s, y el front, 0,37 s.
  9. **Cierre:** con `-Reiniciar` se borraron los datos de la verificación; luego se sincronizó, se preactivaron de nuevo las 5 cuentas y se comprobaron sus inicios de sesión.
- **Defecto encontrado, para F5b (prioridad 1, decisión de Ivan):** tras aprobar la pertinencia, el formulario «Programar primera cita» solo aparece al recargar el expediente. No se corrigió en F6. → cerrado en §15.
- **Monitor externo (J3) y `GET /salud`:** cron-job.org marca como fallida toda respuesta que no sea 2xx, así que el 401 de `GET /api/acceso/sesion` no sirve. Con aprobación de Ivan se añadió `GET /salud`, con pruebas escritas primero en rojo:
  - unitaria: el controlador no tiene dependencias y devuelve siempre `{"estado":"ok"}`;
  - e2e: responde 200 sin sesión, sin `Set-Cookie` y con las cabeceras de seguridad; 30 peticiones seguidas dan 200 sin 429; `POST` da 404.

  Verificación de `back/` antes del merge: lint y typecheck sin errores, format:check correcto, `npm test` con 466 de 466 pruebas (30 suites) y `test:e2e` con 86 de 86 (12 suites). `front/` no cambia. El monitor sondea `https://detecta-web.onrender.com/api/salud` cada 10 minutos; nunca una ruta que consulte la base.

## 15. F5b: correcciones del Jefe y del Psicólogo

- Rama `fase/f5b-correcciones-jefe`, creada desde `main` (`e05c555`). Plan aprobado por Ivan; cierra D38 sin abrir decisiones nuevas.
- **Commit `cf5689b` (defecto 1, Psicólogo):** tras aprobar la pertinencia, el formulario «Programar primera cita» solo aparecía al recargar (§14), porque `POST /pertinencia/:idCaso` devuelve `{estado, mensaje}` sin el caso y el expediente seguía sin psicólogo asignado. Ahora el expediente relee el caso tras el dictamen; además del mensaje se ve el estado («En evaluación», «Archivado» o «Reorientado»). Si la relectura falla, el dictamen ya quedó y se muestra el error.
- **Commit `e513f0e` (defecto 2, Jefe; cierra D38):**
  - backend: `GET /casos/ruta-academica` y `planes` en `GET /casos/:idCaso` (contrato en D38). `RepositorioCasoRiesgo.listarRutaAcademicaPorPrograma(idPrograma)` es nuevo (fuera del diagrama de clases v3); `RepositorioPlanNivelacion.listar` acepta el criterio `caso`. Los DTO del plan se movieron a `respuestas-casos.ts`; `POST /planes` y su finalización responden igual;
  - front: ruta `/jefe-departamento/ruta-academica` y tercer enlace «En ruta académica»; el detalle muestra el plan siempre que el caso esté en ruta académica: cada plan activo con «Finalizar plan», los finalizados en solo lectura encima y el formulario solo si ningún plan está activo, también justo después de finalizar. «Plan de nivelación registrado» solo justo después de registrar. Textos nuevos (aprobados por Ivan): «En ruta académica» y «No hay casos en ruta académica»;
- **Commit `2936eef` (hallazgo de la prueba manual, Psicólogo):** «Registrar resultado» conservaba lo escrito tras un registro exitoso y lo reutilizaba en la cita siguiente; programar y reprogramar también arrastraban la fecha y la modalidad. Ahora cada operación exitosa reinicia solo sus campos (cita: fecha y modalidad; resultado: tipo, observaciones, acuerdos, asistencia, seguimiento y riesgo); un error conserva lo escrito. Ya ocurría en `main`.
- **Commit `2af364e` (enlace de regreso del detalle del Jefe):** cumple el Manual 3.1.2.2.6 (Tabla 30, «Dar el control al usuario») y retira la limitación anotada en el commit `e513f0e`, por la que el menú resaltaba siempre «Casos pendientes». Ahora el detalle muestra, antes de los datos del caso, el enlace «Volver a casos pendientes» o «Volver a casos en ruta académica» (textos aprobados por Ivan), y el menú resalta esa misma bandeja. El origen lo envía la bandeja en el estado de navegación (la recarga lo conserva); sin él, o con un valor no permitido, decide la ruta del caso tal como se cargó (ruta académica: «En ruta académica»; en otro caso, «Casos pendientes»); mientras carga o si la carga falla, «Casos pendientes». Canalizar no cambia el origen. La regla `.volver` de `jefe-departamento.module.css` duplica la de `psicologo.module.css` (`display: inline-block; margin-bottom: var(--espacio-3)`) y se unifica en la fase D3 de componentes compartidos. Solo front: sin cambios de contrato ni de backend; `front/` con 268 pruebas (29 archivos).
- **Verificación:** `back/` con 471 pruebas unitarias (30 suites), 135 de integración (15) y 88 e2e (12); `front/` con 268 pruebas (29 archivos). Lint, tipos y formato limpios en ambos.
- **Prueba funcional del backend por HTTP sobre la demo local (23/11/2026):** C1 a C10 y D1 a D4 correctos: bandeja y ruta académica, `planes` con sus seis campos, `[FINALIZADO, ACTIVO]` tras un segundo plan, D18 (la solicitud psicosocial no aparece y su detalle da 403), 403 para otros roles y 401 sin sesión; aprobar, archivar y reorientar devuelven `EN_EVALUACION`, `ARCHIVADO` y `REORIENTADO` en la consulta del psicólogo.
- **Prueba manual del front por Ivan sobre la demo local (23/11/2026):**
  - Jefe: los planes del caso, su orden, la recarga del detalle y la bandeja «En ruta académica»;
  - Psicólogo: aprobar la pertinencia sin recargar, citas (programar y reprogramar), resultado, seguimiento y cierre del caso.
  - En esta prueba apareció el defecto del Commit `2936eef`; su corrección está cubierta por pruebas automáticas (`front/src/pruebas/psicologo-atencion.test.tsx`, «Formularios tras cada operación (F5b, Commit 3)», y el segundo resultado de la prueba de punta a punta).
- **Pendientes para el rediseño (no se tocaron):** (1) los formularios «Reprogramar» de varias citas comparten fecha y modalidad; (2) `OperacionesExpediente` mide 369 líneas con complejidad 24 (reglas: 80 y 8); (3) «Reprogramar» arranca en Presencial aunque la cita sea Virtual: debería iniciar con la modalidad actual de la cita.
