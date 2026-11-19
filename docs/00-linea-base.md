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

- Un menor sin consentimiento no puede registrar el resultado de la sesión (ER R06, situación 2): lo aplica el servicio de B7 con `habilitadoParaAtencion`, porque `Cita` no conoce a su caso.
- El cruce de horario al reprogramar una cita lo verifica el servicio de B7 (`Cita` no conoce al psicólogo).
- Qué ve el Jefe de una solicitud académica confidencial y la aplicación de `puedeVerContenidoConfidencial` (D18): se definen en el plan de B7.
- Requisitos de B7 (desde B6):
  - canalizar exige que el programa tenga jefe; si no lo hay, el sistema responde con un mensaje claro (hoy el adaptador lanza un error al derivar `id_jefe`);
  - un caso de un programa sin jefe se guarda con `id_jefe` NULL y es visible por programa: aparece en la bandeja en cuanto se configura el jefe (D17).
- Para B9: D15, limitador por IP de solicitudes de activación, `UV_THREADPOOL_SIZE`, y medición de rendimiento de los grafos completos y del guard.
- Para B9 (sincronización):
  - medir `sincronizarTodo` con unos 2000 estudiantes: unas 14 000 consultas en una sola transacción, con el bloqueo exclusivo retenido mientras dura;
  - el estado compartido en `omisionesUltimaLectura()` y `obtenerUltimoResultado()` no es seguro si algún día se corre más de una sincronización en paralelo (hoy el bloqueo lo impide).
- Para B9 (correo y dependencias):
  - revisar los avisos de `npm audit` (D25) sin `--force`;
  - los correos de alerta de B6 no deben bloquear la operación de negocio (ER Tabla 1: menos de 5 s).
- Para B9 (desde B6):
  - `listarPorRol(PSICOLOGO)` carga la agenda completa de cada psicólogo para notificarle una solicitud psicosocial;
  - los envíos en segundo plano se pierden si el proceso muere antes de terminarlos (D24);
  - los tiempos medidos en B6 (consultas de 98 ms como máximo, radicación de 101 ms) son indicativos: se miden con carga en B9.
- Para F1 (frontend):
  - si la base de datos no está disponible al radicar una solicitud (R02, 503), conservar una copia temporal local del formulario para reintentar;
  - evitar el doble envío de los formularios, porque cada alerta o solicitud genera su propio caso.

**Estado de las fases**

| Fase | Estado |
|---|---|
| B0, B1, B2 y B3 | Cerradas (17/11/2026) |
| B4 | Cerrada (17/11/2026): 181 pruebas unitarias, 83 de integración y 33 e2e |
| B5 | Cerrada (17/11/2026): 221 pruebas unitarias, 89 de integración y 37 e2e. Verificación del correo real con Brevo pendiente de Ivan |
| B6 | Cerrada (18/11/2026): 277 pruebas unitarias, 96 de integración y 48 e2e |
| B7 | Siguiente |
| B8 y B9 | Pendientes |

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

**Nota para F0:** el enlace de activación lleva el token en el fragmento de la URL (`/activar#token=…`), que el navegador nunca envía al servidor ni en la cabecera `Referer`. La página de activación del front debe leer el token del fragmento y enviarlo en el **cuerpo** del `POST /acceso/activar` (`{ token, contrasena }`), nunca en la URL.

## 8. Decisiones (ante una decisión abierta, el agente debe detenerse y preguntar)

| # | Tema | Fase límite | Estado |
|---|---|---|---|
| D5 | Fuente de `Estudiante.fechaNacimiento` | Antes de B4 | Resuelta. `fecha_nacimiento` viene de la base institucional (ER Tabla 2) |
| D6 | Credenciales de las cuentas y origen de los usuarios | Antes de B3 | Resuelta (corregida). Solo los estudiantes se sincronizan; docentes, jefes, psicólogos, programas, cursos y asignación docente–curso se cargan con el script de datos iniciales. Las cuentas se activan por enlace con token de un solo uso enviado al correo institucional (sirve para todas las cuentas y para recuperar la contraseña) |
| D7 | Docente obligatorio en un caso de riesgo (ER 3.5.5) | Antes de B2 | Resuelta (16/11/2026). Sin docente obligatorio; un caso tiene motivo, estudiante y exactamente un origen (Alerta o SolicitudAcompanamiento); prevalece sobre el ER 3.5.5 |
| D8 | Reglas sin definir y fuera de los diagramas: tiempo máximo de canalización, si se notifica al estudiante la canalización, máximo de reprogramaciones de una cita | No implementar | Sin decisión |
| D9 | Duración de una cita; hoy el cruce es solo misma fecha y hora exactas | Antes de B7 | Abierta |
| D10 | Contenido de `PlanNivelacion.descripcion`; hoy queda vacía | Antes del plan de B8 | Abierta |
| D11 | Si `REORIENTADO` cuenta como caso finalizado en el informe | Antes de B7 | Abierta |
| D12 | Periodo de un caso o plan | Antes de B7 | Resuelta (17/11/2026). El periodo de un caso o plan es el del curso; las solicitudes voluntarias quedan fuera de los informes por periodo; `listarPorPeriodo` de casos devuelve solo cerrados o archivados |
| D13 | Carga de usuarios y configuración que no llegan por sincronización | B3 y B4 | Resuelta. Script de datos iniciales con archivo JSON: programas y usuarios en B3; cursos y asignación docente–curso en B4 |
| D14 | Duración de la sesión | B3 | Resuelta. Sesión de 60 minutos fijos |
| D15 | Bloqueo por intentos fallidos | Antes de B9 | Abierta. No en B3; limitador en memoria en B9, junto con un limitador por IP para solicitudes de activación y revisión de `UV_THREADPOOL_SIZE` por el costo de bcrypt |
| D16 | Vida del token de activación y límite de solicitudes | B3 | Resuelta. Token de activación de 30 minutos y 3 solicitudes por cuenta y por hora |
| D17 | Cambio de jefe de un programa (requiere el concepto de cuenta inactiva) | Posterior | Abierta |
| D18 | Qué ve el Jefe de una solicitud académica confidencial; el ER 3.7 c ("únicamente psicología") y el perfil del Estudiante (oculta a docentes y estudiantes) se contradicen | Antes del plan de B7 | Parcial. Hecho en B6: el caso de la solicitud nace confidencial, el correo al jefe o a los psicólogos es genérico y el estudiante ve su propio motivo. Abierto: qué ve el Jefe y la aplicación de `puedeVerContenidoConfidencial` |
| D19 | Contenido confidencial | B3 | Resuelta. Psicólogo con ruta `PSICOLOGICA` y caso sin asignar o asignado a él |
| D20 | Lo que deja de venir en la fuente institucional (estudiantes o registros) se conserva sin marca, porque no hay `DELETE` | Posterior | Abierta |
| D21 | Qué es "matrícula activa" al radicar una solicitud (R02): la Tabla 2 no trae un campo de estado de matrícula y la vista solo expone matrículas activas | B6 | Resuelta (18/11/2026). Matrícula activa = al menos un `RegistroAcademico` del estudiante, sin periodo vigente. Limitación: quien deja de venir en la fuente conserva sus registros (D20) |
| D22 | `codigo_asignatura = Curso.idCurso`: un curso por asignatura; un periodo nuevo exige cursos nuevos con códigos nuevos | B4 | Aceptada como limitación |
| D23 | Reasignar un curso a otro docente en `datos:iniciales`: hoy falla con un mensaje explicativo | Posterior | Abierta |
| D24 | Entrega de correos sin cola ni reintentos | B5 | Aceptada como limitación. Un fallo se registra como "Error de envío" y no se reintenta; la entrega no está garantizada (ER Tabla 1) |
| D25 | Avisos de `npm audit` en `picomatch` y `glob` (dependencias anteriores a B5) | B9 | Abierta |
| D26 | Quién recibe el correo de cita según el evento: estudiante, psicólogo o jefe | Antes del plan de B7 | Abierta |
| D27 | Estado que ven el estudiante y el docente de una solicitud o alerta: la regla de B1 marca el origen ATENDIDO al generar el caso, y CUD02 dice que la solicitud queda pendiente | B6 | Resuelta (18/11/2026). Se deriva del caso al leer: `PENDIENTE` mientras el caso esté PENDIENTE y `ATENDIDA` en cualquier otro estado, sin ruta ni avance; el estado guardado del origen no cambia |
| D28 | Código único de rastreo de la solicitud (R02) | B6 | Aceptada como limitación. Es `idOrigen` (UUID) |

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
