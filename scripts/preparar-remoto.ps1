<#
.SYNOPSIS
  Prepara y verifica las bases remotas de la demostración en Neon (F6).

.DESCRIPTION
  Valida demo/.env.remoto, comprueba que detecta-postgres esté activo (se
  usa su psql 18; no se toca ninguna base local) y ejecuta
  scripts/preparar-remoto.mjs:
    1. comprueba que el servidor remoto sea PostgreSQL 18;
    2. crea o actualiza los roles detecta_app, detecta_migrador e
       institucional_lector, con el mismo modelo de F5a;
    3. crea detecta_entrega e institucional_entrega con sus permisos;
    4. migra detecta_entrega y carga la Tabla 25 en institucional_entrega;
    5. crea los datos iniciales. Los enlaces van a
       %USERPROFILE%\detecta-entrega\enlaces-activacion-remoto.txt, nunca a
       la consola;
    6. verifica atributos de los roles, privilegios y rechazos reales.
  Es idempotente: no borra bases ni datos.

.PARAMETER SoloVerificar
  Solo ejecuta el paso 6.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\preparar-remoto.ps1
#>
param(
  [switch]$SoloVerificar
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'demo-comun.ps1')

$raiz = Split-Path -Parent $PSScriptRoot
& node (Join-Path $raiz 'scripts/validar-entorno-demo.mjs') --remoto
if ($LASTEXITCODE -ne 0) {
  throw 'demo/.env.remoto no es válido (ver mensajes anteriores).'
}
Assert-PostgresActivo

$argumentos = @((Join-Path $raiz 'scripts/preparar-remoto.mjs'))
if ($SoloVerificar) {
  $argumentos += '--solo-verificar'
}
& node @argumentos
if ($LASTEXITCODE -ne 0) {
  throw 'Falló la preparación remota (ver mensajes anteriores).'
}
Write-Host 'Bases remotas preparadas y verificadas.'
