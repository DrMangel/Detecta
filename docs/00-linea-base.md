# DETECTA — Línea base para la implementación del backend

Documento de trabajo, no es la documentación técnica definitiva. Estado al 16 de noviembre de 2026.
Reúne lo que el agente de codificación necesita saber y no puede inferir de los diagramas: versiones vigentes, decisiones, diferencias entre fuentes y puntos abiertos.

## 1. Orden de autoridad

1. Diagramas en `docs/diagramas/` (vigentes y aprobados por Ivan el 16/11/2026).
2. Este documento.
3. ER (v1.4, 04/11/2026) y Manual del sistema (v1.2, 30/10/2026) en `docs/referencias/`.
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
- Patrón Repositorio opción B: `Repositorio<T>` como base más seis repositorios especializados (`RepositorioPersona`, `RepositorioCasoRiesgo`, `RepositorioAlerta`, `RepositorioSolicitud`, `RepositorioRegistroAcademico`, `RepositorioPlanNivelacion`). Un único adaptador `RepositorioPersistente<T>` realiza todos los contratos.
- Los controladores heredan de `ControladorBase` (verifica permisos con `ControlAcceso`). No hay dependencia de código desde controladores ni servicios hacia `persistencia` o `integracion`: los adaptadores se inyectan al iniciar.
- `contrasenaHash` es un atributo privado de `Persona`.
- Token de sesión en cookie `HttpOnly`, `Secure` y `SameSite`.

## 5. Decisiones técnicas del entorno y del plan

Estas decisiones no están en los diagramas; vienen de Ivan (plan del backend y entorno):

- PostgreSQL 18 en Docker, ya configurado en el entorno de desarrollo.
- Dos bases de datos: `detecta` e `institucional_demo`. La segunda simula la BD institucional con un CSV y una vista de solo lectura.
- TypeORM con herencia de tabla única para `Persona`.
- Autenticación con JWT en cookie y bcrypt.
- Correo por SMTP/TLS con Brevo, detrás de la interfaz `ProveedorCorreo`.
- El usuario de base de datos de la aplicación no tiene permiso de eliminación (ER 3.7 c: el historial de alertas y casos no se elimina).
- Las rutas REST, los DTO y los códigos de error **no están definidos** en los diagramas; el agente debe proponerlos en el plan de cada fase y esperar aprobación.

## 6. Requisitos no funcionales relevantes para el backend (ER)

- Rendimiento (3.4, 3.7 g): consultas de un estudiante o de un psicólogo en menos de 2 s; sincronización de un curso de hasta 60 estudiantes en menos de 10 s; creación del caso por solicitud en menos de 3 s; informe en menos de 5 s; carga pico sin superar el doble de esos valores; 200 usuarios concurrentes y 100 terminales.
- Capacidad (3.4.1 c): al menos 2000 estudiantes, cursos de hasta 60, más de 50 docentes, 2 a 3 psicólogos y 20 a 30 jefes.
- Interfaz de correo (Tabla 1): procesamiento y envío al servicio externo en menos de 5 s.
- Interfaz de sincronización (Tabla 2): conexión y resultado en menos de 5 s. Rangos: `id_estudiante` alfanumérico 5 a 20; `nombre_estudiante` 2 a 150; `correo_estudiante` máximo 100; `programa_academico` 3 a 100; `codigo_asignatura` 3 a 20; `calificacion_acumulada` 0.00 a 5.00 (2 decimales); `porcentaje_asistencia` 0.00 a 100.00 (2 decimales). Registros fuera de rango se omiten con advertencia. La sincronización no debe quedar registrada de forma parcial ante una interrupción (3.7 a).
- Acceso (3.5.3): el estudiante solo ve lo suyo; el docente, sus cursos y sus alertas; el Jefe, su programa sin acceso a contenidos clínicos; el psicólogo, los casos de su ruta y sus asesorías. El contenido del expediente psicológico solo lo ve el psicólogo.
- Integridad (3.5.5): registro académico con estudiante y curso válidos; alerta con registro académico; correo único por usuario.
- Seguridad (3.6.2, 3.7 c): bcrypt, OWASP Top 10, roles, transmisión cifrada, historial sin eliminación.

## 7. Diferencias conocidas entre el ER/Manual y el diseño (seguir el diseño)

- **Alertas automáticas:** ER 1.3.2, 1.4 (Alerta temprana), 3.5.1 y 3.7 f, y glosario y CU_05 del Manual hablan de generación automática. Vigente: emisión manual por el docente.
- **R07:** el ER filtra por "código de departamento" y "código de asignatura". Vigente: periodo, `idPrograma` e `idCurso`.
- **Tabla 2 del ER:** `nombre_asignatura`, `id_docente` y `nombre_docente` no son entradas del componente de compatibilidad; `codigo_asignatura` es solo la clave de enlace al curso configurado.
- **Notificaciones:** el ER (Tabla 1) lista tres tipos de correo; el diagrama de clases tiene cuatro operaciones en `ServicioNotificacion` (agrega `notificarPlanNivelacion`). Vigente: el diagrama.
- **R04:** el ER pide el "código del estudiante beneficiario"; la secuencia usa `idCaso` (el caso identifica al estudiante).
- **Consentimiento:** el ER menciona la validación de minoría de edad en R05; la confirmación del consentimiento se hace en R06 (`ControladorAtencionPsicologica`).
- **Modelo de dominio del Manual:** incluye Acudiente, Vicerrector, Consentimiento_informado y Politicas_permanencia; son del negocio, no del sistema (no crear estas entidades).
- **"Remisión":** el ER la menciona como entidad (3.5.5); no existe en el diseño. No crearla.

## 8. Decisiones abiertas (el agente debe detenerse y preguntar)

| # | Tema | Fase límite | Estado |
|---|---|---|---|
| D5 | Fuente de `Estudiante.fechaNacimiento`: la Tabla 2 del ER no la incluye entre los campos de la BD institucional | Antes de B4 | Ivan indicó asumirlo resuelto, pero el criterio no consta |
| D6 | Cómo se crean las credenciales (`contrasenaHash`) de los estudiantes que llegan por sincronización | Antes de B3 | Igual que D5 |
| D7 | ER 3.5.5 exige que un caso de riesgo esté asociado a un docente; en el diseño un caso nacido de una solicitud voluntaria no tiene docente | Antes de B2 | Por confirmar |
| D8 | Reglas sin definir y fuera de los diagramas: tiempo máximo de canalización, si se notifica al estudiante la canalización, máximo de reprogramaciones de una cita | No implementar | Sin decisión |

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
