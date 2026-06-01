$ErrorActionPreference = "Stop"

$demoRoot = Split-Path -Parent $PSScriptRoot
node (Join-Path $demoRoot "src/path-report.js")
