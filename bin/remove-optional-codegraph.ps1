param(
  [switch] $DryRun
)
$ErrorActionPreference = "Stop"

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Host "Claude CLI not found; cannot inspect or remove optional codegraph MCP."
  exit 0
}

Write-Host "Current MCP servers:"
$mcpList = claude mcp list 2>&1
Write-Host $mcpList
Write-Host ""

if (-not ($mcpList -match "codegraph")) {
  Write-Host "codegraph not found in MCP list; nothing to remove."
  exit 0
}

Write-Host "Removing optional duplicate codegraph MCP..."
if ($DryRun) {
  Write-Host "dry-run: would run claude mcp remove codegraph"
} else {
  claude mcp remove codegraph
  if ($LASTEXITCODE -ne 0) {
    Write-Error "claude mcp remove codegraph failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
  }
  Write-Host ""
  Write-Host "After removal:"
  claude mcp list
  if ($LASTEXITCODE -ne 0) {
    Write-Error "claude mcp list failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
  }
}
