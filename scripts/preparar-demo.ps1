<#
.SYNOPSIS
  Prepara las bases aisladas de la demostración de DETECTA (F5a).

.DESCRIPTION
  Crea, si no existen, detecta_entrega e institucional_entrega dentro del
  contenedor detecta-postgres; aplica los permisos del modelo vigente con los
  roles existentes (decisión de Ivan en F5a); migra detecta_entrega; carga la
  Tabla 25 en institucional_entrega y crea los datos iniciales.

  Los enlaces de activación que imprime datos-iniciales se guardan en
  %LOCALAPPDATA%\detecta-demo\enlaces-activacion.txt, fuera del repositorio;
  el script solo muestra la ruta, nunca el contenido.

.PARAMETER Reiniciar
  Elimina y recrea SOLO detecta_entrega e institucional_entrega, y borra el
  archivo de enlaces. No toca ninguna otra base, contenedor ni volumen.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\preparar-demo.ps1 -Reiniciar
#>
param(
  [switch]$Reiniciar
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'demo-comun.ps1')

$raiz = Split-Path -Parent $PSScriptRoot
$back = Join-Path $raiz 'back'
$carpetaRespaldo = Join-Path $env:LOCALAPPDATA 'detecta-demo'
$archivoEnlaces = Join-Path $carpetaRespaldo 'enlaces-activacion.txt'
$archivoErrores = Join-Path $carpetaRespaldo 'datos-iniciales-errores.txt'

function Assert-RolesExistentes {
  $roles = Invoke-PsqlDemo 'postgres' "SELECT count(*) FROM pg_roles WHERE rolname IN ('detecta_app', 'detecta_migrador', 'institucional_lector')"
  if ("$roles".Trim() -ne '3') {
    throw 'Faltan roles del modelo DETECTA (npm run bd:crear desde back/); este script no crea ni modifica roles.'
  }
}

function Remove-BasesEntrega {
  $lista = ($script:BasesEntrega | ForEach-Object { "'$_'" }) -join ', '
  Invoke-PsqlDemo 'postgres' "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ($lista) AND pid <> pg_backend_pid()" | Out-Null
  foreach ($base in $script:BasesEntrega) {
    Invoke-PsqlDemo 'postgres' "DROP DATABASE IF EXISTS $base" | Out-Null
  }
  if (Test-Path -LiteralPath $archivoEnlaces) {
    Remove-Item -LiteralPath $archivoEnlaces -Force
  }
  Write-Host 'Bases de entrega eliminadas.'
}

# Mismo modelo que docker/postgres/crear-bases.sql para detecta_pruebas e
# institucional_demo: dueño, CONNECT y USAGE. Los permisos sobre tablas los
# dan las migraciones (detecta_app sin DELETE ni TRUNCATE, ER 3.7 c) y
# institucional_entrega.sql (lector solo con SELECT sobre las vistas).
function New-BasesEntrega {
  if (-not (Test-BaseExiste 'detecta_entrega')) {
    Invoke-PsqlDemo 'postgres' 'CREATE DATABASE detecta_entrega OWNER detecta_migrador' | Out-Null
  }
  if (-not (Test-BaseExiste 'institucional_entrega')) {
    Invoke-PsqlDemo 'postgres' 'CREATE DATABASE institucional_entrega OWNER detecta_user' | Out-Null
  }
  Invoke-PsqlDemo 'postgres' 'REVOKE ALL ON DATABASE detecta_entrega FROM PUBLIC; GRANT CONNECT ON DATABASE detecta_entrega TO detecta_app, detecta_migrador; REVOKE ALL ON DATABASE institucional_entrega FROM PUBLIC; GRANT CONNECT ON DATABASE institucional_entrega TO institucional_lector' | Out-Null
  Invoke-PsqlDemo 'detecta_entrega' 'GRANT USAGE ON SCHEMA public TO detecta_app' | Out-Null
  Invoke-PsqlDemo 'institucional_entrega' 'GRANT USAGE ON SCHEMA public TO institucional_lector' | Out-Null
  Write-Host 'Bases de entrega disponibles: detecta_entrega e institucional_entrega.'
}

function Invoke-PasoBack([string]$Descripcion, [scriptblock]$Paso) {
  & $Paso
  if ($LASTEXITCODE -ne 0) {
    throw "Falló: $Descripcion."
  }
}

# La salida estándar lleva los enlaces de activación: va directo al archivo
# de respaldo y nunca a la consola (D6; plan F5a).
function New-DatosIniciales {
  New-Item -ItemType Directory -Force -Path $carpetaRespaldo | Out-Null
  $proceso = Start-Process -FilePath 'node' -WorkingDirectory $back -NoNewWindow -Wait -PassThru `
    -ArgumentList '--env-file=../demo/.env', 'dist/comandos/datos-iniciales.js', '../demo/datos-iniciales.ejemplo.json' `
    -RedirectStandardOutput $archivoEnlaces -RedirectStandardError $archivoErrores
  if ($proceso.ExitCode -ne 0) {
    throw "Falló la creación de los datos iniciales. Revísese $archivoErrores (la salida estándar quedó en $archivoEnlaces)."
  }
  Remove-Item -LiteralPath $archivoErrores -Force
  Write-Host "Datos iniciales creados. Enlaces de activación (no versionar ni compartir): $archivoEnlaces"
}

Assert-EntornoDemo $raiz
Assert-PostgresActivo
Assert-RolesExistentes
if ($Reiniciar) {
  Remove-BasesEntrega
}
New-BasesEntrega

Push-Location $back
try {
  Invoke-PasoBack 'la compilación del backend' { & npm run build }
  Invoke-PasoBack 'las migraciones de detecta_entrega' {
    & node --env-file=../demo/.env dist/persistencia/ejecutar-migraciones.js detecta_entrega migrar
  }
  Invoke-PasoBack 'la carga de la Tabla 25 en institucional_entrega' {
    & node ../docker/postgres/cargar-institucional.mjs --base institucional_entrega
  }
} finally {
  Pop-Location
}
New-DatosIniciales
Write-Host 'Demostración preparada. La variante de columnas ficticias se carga aparte (demo/README.md).'
