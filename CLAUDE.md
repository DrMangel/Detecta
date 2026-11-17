# DETECTA — Instrucciones permanentes para Claude Code

DETECTA es un sistema web de alerta temprana y orientación académica para prevenir la deserción estudiantil (Universidad de Cartagena, proyecto de curso de Ingeniería de Software, metodología RUP).
Este repositorio **implementa un análisis y diseño ya aprobados por el equipo**. Tu trabajo es implementar ese diseño, **no rediseñarlo**.

## Idioma y nombres

- Comunicación, comentarios, mensajes de commit y documentación: español.
- Los nombres de clases, atributos, métodos y enumerados son los de los diagramas, sin tildes y tal cual (p. ej. `Psicologo`, `Asesoria`, `estructurarPlanNivelacion`, `idPrograma`). No los traduzcas, no los renombres y no agregues sinónimos.

## Fuentes de verdad (orden de autoridad)

1. `docs/diagramas/`: diagrama de clases v3, diagrama de entidades, diagrama de paquetes, 6 diagramas de secuencia y vista de escenarios.
2. `docs/00-linea-base.md`: decisiones vigentes, diferencias conocidas entre fuentes y puntos abiertos.
3. `docs/referencias/` (ER y Manual del sistema): requisitos funcionales, tiempos, reglas de acceso y de integridad. El ER y el Manual tienen partes desactualizadas; `00-linea-base.md` dice cuáles.
4. `docs/plan-backend.md`: fases B0 a B9 y su criterio de cierre.

Si dos fuentes se contradicen y la contradicción **no** está resuelta en `00-linea-base.md`, detente y pregunta. No elijas por tu cuenta.

## Reglas de trabajo (obligatorias)

1. **No inventes** clases, atributos, métodos, relaciones, requisitos, endpoints ni decisiones de arquitectura. Si algo no está definido en las fuentes, detente y pregunta.
2. **Plan antes de ejecutar.** Al inicio de cada fase presenta solo un plan: archivos y carpetas, dependencias con versión, comandos, pruebas, criterio de cierre, riesgos y preguntas. No instales, crees ni modifiques nada hasta recibir aprobación explícita. Antes de la aprobación solo se permiten comandos de lectura (`ls`, `cat`, `git status`, `docker ps`, etc.).
3. **Una rama por fase**, con el nombre `fase/bN-descripcion-corta` (por ejemplo `fase/b0-esqueleto`). Nunca hagas commit directo en `main` y nunca hagas merge: el merge lo hace Ivan después de la auditoría.
4. **Solo la fase actual.** No adelantes trabajo de fases posteriores ni agregues funcionalidad que no esté en el plan aprobado.
5. **No modifiques** `docs/` ni los diagramas. Si detectas un error o una inconsistencia en ellos, repórtalo; no lo corrijas.
6. **Commits pequeños** y en español (`feat:`, `fix:`, `test:`, `chore:`, `docs:`).
7. **Informe de cierre de fase.** Al terminar, entrega: qué se construyó; lista de archivos; comandos ejecutados con su salida real (compilación, lint, pruebas); desviaciones respecto a los diagramas o al ER (idealmente ninguna); dudas abiertas. No declares la fase cerrada: la cierra Ivan tras la auditoría.

## Estándares técnicos

- Monorepo con `front/` (React + TypeScript) y `back/` (NestJS + TypeScript con modo estricto).
- Base de datos: PostgreSQL 18 en Docker (ya configurado en el entorno). No elimines ni recrees contenedores o volúmenes existentes sin autorización.
- Secretos y credenciales solo por variables de entorno: `.env` fuera de git y un `.env.example` sin valores reales. Nunca credenciales en el código (ER 3.6.2, OWASP Top 10).
- Contraseñas con bcrypt. Comunicaciones cifradas (HTTPS/TLS).
- Comentarios en el código en español, explicando el porqué y citando el requisito, el diagrama o el caso de uso cuando aplique.
- Lint y pruebas deben pasar antes de declarar terminada una tarea.

## Puntos de parada conocidos

Hay decisiones abiertas que el agente no debe resolver por su cuenta; están en la sección 8 de `docs/00-linea-base.md`. En especial: antes de B2 (D7, integridad del caso de riesgo), antes de B3 (D6, credenciales de estudiantes sincronizados) y antes de B4 (D5, origen de `fechaNacimiento`), detente y pregunta.
