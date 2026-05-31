param(
  [string] $SettingsPath,
  [switch] $DryRun
)
$ErrorActionPreference = "Stop"

$settingsPath = if ($SettingsPath) { $SettingsPath } else { Join-Path $HOME ".claude\settings.json" }
if (-not (Test-Path -LiteralPath $settingsPath)) {
  Write-Host "No global Claude settings found: $settingsPath"
  exit 0
}

$backup = "$settingsPath.bak.$(Get-Date -Format yyyyMMddHHmmss)"

function Convert-HookCommand {
  param([string] $Command)
  $updated = $Command
  $updated = [regex]::Replace(
    $updated,
    '(?<!["''])~[\\/]\.claude[\\/]hooks[\\/]([^\s"'']+)',
    '"$HOME/.claude/hooks/$1"'
  )
  return $updated
}

function Repair-Node {
  param([object] $Node)
  $changed = $false

  if ($null -eq $Node) {
    return $false
  }

  if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string]) -and -not ($Node -is [pscustomobject])) {
    foreach ($item in $Node) {
      if (Repair-Node -Node $item) {
        $changed = $true
      }
    }
    return $changed
  }

  if ($Node -is [pscustomobject]) {
    foreach ($property in $Node.PSObject.Properties) {
      if ($property.Name -eq "command" -and $property.Value -is [string]) {
        $next = Convert-HookCommand -Command $property.Value
        if ($next -ne $property.Value) {
          $property.Value = $next
          $changed = $true
        }
      } elseif (Repair-Node -Node $property.Value) {
        $changed = $true
      }
    }
  }

  return $changed
}

$settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
$changed = Repair-Node -Node $settings

if (-not $changed) {
  Write-Host "No unquoted global Claude hook paths found: $settingsPath"
  exit 0
}

if ($DryRun) {
  Write-Host "dry-run: would update unquoted global Claude hook paths in $settingsPath"
  exit 0
}

Copy-Item -LiteralPath $settingsPath -Destination $backup
$json = $settings | ConvertTo-Json -Depth 100
Set-Content -LiteralPath $settingsPath -Value $json -Encoding UTF8

Write-Host "Updated global Claude settings path quoting."
Write-Host "Backup: $backup"
