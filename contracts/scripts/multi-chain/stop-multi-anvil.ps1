#
# Stop Multi-Anvil Environment (Windows PowerShell)
#

$STATE_DIR = "$env:USERPROFILE\.anvil-state"

Write-Host "Stopping Multi-Anvil Environment..." -ForegroundColor Yellow
Write-Host ""

function Stop-AnvilNode {
    param($Name)
    $pidFile = "$STATE_DIR\$Name.pid"
    if (Test-Path $pidFile) {
        $processId = Get-Content $pidFile
        try {
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($process) {
                Stop-Process -Id $processId -Force
                Write-Host "[OK] Stopped $Name (PID: $processId)" -ForegroundColor Green
            } else {
                Write-Host "[--] $Name was not running (PID: $processId)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "[--] $Name was not running" -ForegroundColor Yellow
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "[--] No PID file found for $Name" -ForegroundColor Yellow
    }
}

Stop-AnvilNode "base"
Stop-AnvilNode "arbitrum"
Stop-AnvilNode "arc"

# Also kill any remaining anvil processes by name
Write-Host ""
Write-Host "Checking for remaining anvil processes..." -ForegroundColor Yellow

$anvilProcesses = Get-Process -Name "anvil" -ErrorAction SilentlyContinue
if ($anvilProcesses) {
    foreach ($proc in $anvilProcesses) {
        try {
            Stop-Process -Id $proc.Id -Force
            Write-Host "[OK] Killed anvil process (PID: $($proc.Id))" -ForegroundColor Green
        } catch {
            # Process already gone
        }
    }
} else {
    Write-Host "[--] No remaining anvil processes found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Multi-Anvil Environment Stopped!" -ForegroundColor Green
