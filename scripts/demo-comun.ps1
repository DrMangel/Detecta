# Funciones comunes de preparar-demo.ps1 e iniciar-demo.ps1 (F5a).
# Se carga con «. (Join-Path $PSScriptRoot 'demo-comun.ps1')».
# Compatible con Windows PowerShell 5.1: no se redirige la salida de error de
# los ejecutables nativos (5.1 la convierte en excepción con -ErrorAction Stop).

$script:Contenedor = 'detecta-postgres'
$script:Superusuario = 'detecta_user'
# Lista blanca: los scripts de la demo solo crean, borran o modifican estas
# dos bases (plan F5a). detecta, institucional_demo, detecta_pruebas,
# detecta_carga e institucional_carga nunca se tocan.
$script:BasesEntrega = @('detecta_entrega', 'institucional_entrega')

function Assert-EntornoDemo([string]$Raiz) {
  & node (Join-Path $Raiz 'scripts/validar-entorno-demo.mjs')
  if ($LASTEXITCODE -ne 0) {
    throw 'demo/.env no es válido para la demostración (ver mensajes anteriores).'
  }
}

# No inicia, crea ni recrea contenedores ni volúmenes (CLAUDE.md).
function Assert-PostgresActivo {
  $estado = & docker ps -a --filter "name=^$script:Contenedor$" --format '{{.State}}'
  if ($LASTEXITCODE -ne 0) {
    throw 'Docker no responde. Iníciese Docker Desktop y repítase el comando.'
  }
  if ("$estado".Trim() -ne 'running') {
    throw "El contenedor $script:Contenedor no está activo. Iníciese con «docker start $script:Contenedor»; este script no inicia ni recrea contenedores."
  }
  & docker exec $script:Contenedor pg_isready -q -U $script:Superusuario -d postgres
  if ($LASTEXITCODE -ne 0) {
    throw 'PostgreSQL todavía no acepta conexiones; espérense unos segundos y repítase el comando.'
  }
}

# Ejecuta una sola sentencia (o varias SQL sin metacomandos) como superusuario.
function Invoke-PsqlDemo([string]$Base, [string]$Sql) {
  if (@('postgres') + $script:BasesEntrega -notcontains $Base) {
    throw "Base fuera de la lista blanca de la demo: $Base"
  }
  $salida = & docker exec $script:Contenedor psql -U $script:Superusuario -d $Base -v ON_ERROR_STOP=1 -qtAc $Sql
  if ($LASTEXITCODE -ne 0) {
    throw "Falló una sentencia sobre $Base."
  }
  return $salida
}

function Test-BaseExiste([string]$Base) {
  $existe = Invoke-PsqlDemo 'postgres' "SELECT 1 FROM pg_database WHERE datname = '$Base'"
  return "$existe".Trim() -eq '1'
}
