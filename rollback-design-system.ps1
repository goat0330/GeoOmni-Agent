$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root
try {
    node tools/rollback-design-system.mjs
}
finally {
    Pop-Location
}
