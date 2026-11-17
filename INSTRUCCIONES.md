# Cómo usar este paquete de contexto

Esta carpeta tiene lo que Claude Code necesita para empezar el backend de DETECTA sin ver la conversación en la que se hizo el diseño.

## Qué contiene

```
CLAUDE.md                  Reglas permanentes del agente (va en la raíz del repo)
docs/00-linea-base.md      Versiones vigentes, decisiones, diferencias y puntos abiertos
docs/plan-backend.md       Fases B0 a B9 y su criterio de cierre
docs/diagramas/            10 diagramas (PNG)
docs/referencias/          (vacía: ver paso 2)
prompts/B0.md              Prompt de la fase B0 (solo pide el plan)
```

## Pasos

1. Copia el contenido de esta carpeta a la raíz de tu repo (`CLAUDE.md`, `docs/` y `prompts/`).
2. Copia a `docs/referencias/` los dos originales, que no pude incluir: `ER_6.docx` y `Manual del sistema_6.docx`. Son las versiones v1.4 del ER y v1.2 del Manual.
3. Recomendado: copia a `docs/diagramas/` los fuentes `.puml` de los diagramas. El agente lee texto con más fiabilidad que una imagen densa, sobre todo el diagrama de clases.
4. Crea una rama (por ejemplo `docs/linea-base`), haz commit de estos archivos y fusiónala en `main` antes de empezar B0, para que todas las ramas de fase partan con este contexto.
5. Abre Claude Code en la raíz del repo y pega el contenido de `prompts/B0.md` (desde "Vas a trabajar..." hasta el final).
6. El agente responderá solo con un plan. Pásamelo: lo reviso contra el plan de B0 y te digo si se aprueba. Después apruebas tú en Claude Code.
7. Cuando termine, pásame su informe de cierre, el `git diff --stat` y la salida de los comandos. Lo audito y cerramos la fase.

## Antes de empezar B3 y B4

Hay decisiones abiertas (D5, D6, D7 en la sección 8 de `docs/00-linea-base.md`). Las dejamos cerradas antes de esas fases. D7 afecta a B2.
