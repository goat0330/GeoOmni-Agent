$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root
try {
    node tools/apply-design-system.mjs
    Write-Host "GeoOmni Design System installed." -ForegroundColor Cyan
    Write-Host "Run: npm run design:test; npm run design:audit" -ForegroundColor DarkGray
    Write-Host "Golden reference: http://127.0.0.1:4173/design-system/examples.html" -ForegroundColor DarkGray
}
finally {
    Pop-Location
}
