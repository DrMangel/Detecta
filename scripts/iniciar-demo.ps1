<#
.SYNOPSIS
  Inicia DETECTA en modo demostración con un solo comando (F5a).

.DESCRIPTION
  Comprueba demo/.env, Docker, que detecta-postgres esté activo y acepte
  conexiones, que existan las bases de entrega y que los puertos 3000 y 5173
  estén libres. Luego lanza el backend (con demo/.env) y el front (Vite), y al
  terminar (Ctrl+C o caída de uno de los dos) cierra solo los procesos que
  lanzó, por PID. No inicia ni recrea contenedores.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\iniciar-demo.ps1
#>

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'demo-comun.ps1')

$raiz = Split-Path -Parent $PSScriptRoot
$back = Join-Path $raiz 'back'
$front = Join-Path $raiz 'front'
$puertoBack = 3000
$puertoFront = 5173
$esperaMaximaSeg = 90

function Test-PuertoEscuchando([int]$Puerto) {
  $conexiones = Get-NetTCPConnection -State Listen -LocalPort $Puerto -ErrorAction SilentlyContinue
  return $null -ne $conexiones
}

# Si un backend de desarrollo ya ocupa el puerto, el front de la demo le
# enviaría las peticiones y se usaría la base detecta: se aborta antes.
function Assert-PuertosLibres {
  foreach ($puerto in @($puertoBack, $puertoFront)) {
    if (Test-PuertoEscuchando $puerto) {
      throw "El puerto $puerto está en uso. Deténgase el proceso que lo ocupa y repítase el comando."
    }
  }
}

function Assert-DemoPreparada {
  foreach ($base in $script:BasesEntrega) {
    if (-not (Test-BaseExiste $base)) {
      throw "No existe $base. Ejecútese antes scripts\preparar-demo.ps1."
    }
  }
  if (-not (Test-Path -LiteralPath (Join-Path $back 'dist/main.js'))) {
    throw 'Falta la compilación del backend. Ejecútese antes scripts\preparar-demo.ps1.'
  }
}

function Wait-Puerto([int]$Puerto, [System.Diagnostics.Process]$Proceso) {
  $limite = (Get-Date).AddSeconds($esperaMaximaSeg)
  while (-not (Test-PuertoEscuchando $Puerto)) {
    if ($Proceso.HasExited) {
      throw "El proceso que debía escuchar en el puerto $Puerto terminó (código $($Proceso.ExitCode))."
    }
    if ((Get-Date) -gt $limite) {
      throw "El puerto $Puerto no respondió en $esperaMaximaSeg s."
    }
    Start-Sleep -Milliseconds 500
  }
}

Assert-EntornoDemo $raiz
Assert-PostgresActivo
Assert-DemoPreparada
Assert-PuertosLibres

$lanzados = @()
$backendAnterior = $env:BACKEND_DESARROLLO
try {
  $procesoBack = Start-Process -FilePath 'node' -WorkingDirectory $back -NoNewWindow -PassThru `
    -ArgumentList '--env-file=../demo/.env', 'dist/main.js'
  $lanzados += $procesoBack
  Wait-Puerto $puertoBack $procesoBack

  # El proxy de Vite lee BACKEND_DESARROLLO; se fija al backend de la demo y se
  # restaura al salir para no alterar la sesión.
  $env:BACKEND_DESARROLLO = "http://localhost:$puertoBack"
  $procesoFront = Start-Process -FilePath 'node' -WorkingDirectory $front -NoNewWindow -PassThru `
    -ArgumentList 'node_modules/vite/bin/vite.js'
  $lanzados += $procesoFront
  Wait-Puerto $puertoFront $procesoFront

  Write-Host ''
  Write-Host "DETECTA (demostración) disponible en http://localhost:$puertoFront"
  Write-Host 'Pulse Ctrl+C para detenerla.'
  while (-not ($lanzados | Where-Object { $_.HasExited })) {
    Start-Sleep -Seconds 1
  }
  Write-Host 'Uno de los procesos de la demostración terminó; se detiene el otro.'
} finally {
  foreach ($proceso in $lanzados) {
    if (-not $proceso.HasExited) {
      Stop-Process -Id $proceso.Id -Force
    }
  }
  $env:BACKEND_DESARROLLO = $backendAnterior
  Write-Host "Procesos de la demostración detenidos: $(($lanzados | ForEach-Object { $_.Id }) -join ', ')"
}
