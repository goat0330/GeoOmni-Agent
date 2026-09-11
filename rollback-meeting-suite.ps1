$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root
try { node tools/rollback-meeting-suite.mjs }
finally { Pop-Location }
