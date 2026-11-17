# DETECTA — Plan de implementación del backend (B0 a B9)

Plan definido por Ivan. Cada fase tiene un criterio de cierre que se audita contra los diagramas y el ER.

## Método de cada fase

1. Ivan escribe el prompt para el agente de codificación.
2. El agente muestra su plan antes de ejecutar y espera aprobación.
3. Aprobado el plan, el agente trabaja en una rama propia (`fase/bN-...`).
4. Al terminar, entrega el informe de cierre y Ivan lo audita (con apoyo de Claude) contra los diagramas y el ER.
5. La fase se cierra solo cuando la auditoría confirma el cumplimiento.

## Fases

| Fase | Qué se construye | Carpetas | Cierre |
|---|---|---|---|
| B0 | Monorepo, NestJS con TypeScript estricto, variables de entorno, PostgreSQL con las bases `detecta` e `institucional_demo`, `.gitignore`, README | `front`, `back` y su esqueleto | Compila, pasa el lint y conecta a ambas bases |
| B1 | Las 16 entidades y sus enumerados (`Rol` con cuatro valores, `NivelRiesgo`, `RutaAtencion`, `EstadoCaso`…), con los métodos del diagrama | `dominio/entidades` | Pruebas unitarias de las reglas de cada entidad |
| B2 | Mapeo TypeORM con herencia de tabla única, migraciones, contrato `Repositorio` y los 6 especializados, `RepositorioPersistente<T>`, usuario de BD sin permiso de eliminación | `dominio/repositorios`, `persistencia` | Pruebas de integración contra PostgreSQL |
| B3 | `ServicioAutenticacion`, `ControladorAcceso`, bcrypt con `contrasenaHash`, JWT en cookie, guard, `ControlAcceso`, `ControladorBase.verificarPermiso`, usuarios iniciales | `aplicacion/servicios`, `controladores` | Un usuario de cada rol inicia sesión y es rechazado fuera de su rol |
| B4 | `ConectorBDConfigurable`, `ServicioSincronizacion`, `ControladorSincronizacion` (tarea nocturna y orden manual externa), `institucional_demo` con el CSV y la vista de solo lectura | `integracion`, `aplicacion/contratos` | Sincronizar un curso de 60 estudiantes en menos de 10 s, de forma transaccional |
| B5 | `ServicioNotificacion`, `ProveedorCorreo`, `ProveedorCorreoExterno` por SMTP/TLS con Brevo | `integracion`, `aplicacion` | Correo de prueba enviado sin contenido confidencial |
| B6 | R01 y R02: `ControladorAlertas`, `ControladorConsultaEstudiante`, `ControladorSolicitudes` | `controladores` | Flujos completos del docente y del estudiante |
| B7 | R03, R05 y R06: `ControladorCasosRiesgo`, `ControladorPertinencia`, `ControladorAtencionPsicologica`, con consentimiento, citas y asesorías | `controladores` | Caso de riesgo de punta a punta, incluido el menor de edad |
| B8 | R04 y R07: `ControladorPlanNivelacion`, `ControladorInformes`, `GeneradorInformeRiesgo` con exportación | `controladores`, `aplicacion/servicios` | Informe por asignatura en menos de 5 s |
| B9 | Cierre del backend: validaciones y errores uniformes, revisión OWASP, pruebas de carga (200 usuarios, consultas en menos de 2 s), documentación de la API | todo `back` | Cumple los tiempos del ER 3.4 y 3.7 g |

## Por qué este orden

Primero las bases (entidades, persistencia, autenticación), porque todo lo demás depende de ellas. Luego la sincronización, que es la fuente de los registros académicos que alimentan las alertas, y las notificaciones, que usan los flujos. Al final los flujos de negocio, de menor a mayor complejidad. B4 y B7 son las fases de más riesgo.

## Después del backend (se detalla cuando se llegue)

- F0 a F2, frontend: esqueleto de React y flujo de sesión, pantallas por rol (`paginas`), y la vista del estado de la sincronización que pide el ER 3.3.5.
- Cierre: despliegue local reproducible, instructivo de instalación y evidencias para el Manual.
- Las pruebas de caja negra y de usabilidad pertenecen a la fase de Transición y se planifican aparte.
