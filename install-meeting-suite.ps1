$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root
try {
    node tools/apply-meeting-suite.mjs
    node --check meeting-feature/meeting-suite.js
    node --check serve.mjs
    npm run meeting:test
    npm run meeting:audit
    if (Test-Path "scripts/design-system-audit.mjs") { npm run design:audit }
    Write-Host "GeoOmni Meeting Suite v2 installed and validated." -ForegroundColor Cyan
    Write-Host "Start: npm start" -ForegroundColor DarkGray
    Write-Host "Defense response: http://127.0.0.1:4173/defense-response" -ForegroundColor DarkGray
    Write-Host "History: http://127.0.0.1:4173/meeting-history" -ForegroundColor DarkGray
}
finally { Pop-Location }
