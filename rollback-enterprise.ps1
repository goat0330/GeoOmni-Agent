$ErrorActionPreference = "Stop"
$backup = Join-Path $PSScriptRoot "serve.mjs.pre-enterprise.bak"
$target = Join-Path $PSScriptRoot "serve.mjs"

if (-not (Test-Path $backup)) {
    throw "未找到 serve.mjs.pre-enterprise.bak，无法自动回滚 serve.mjs。"
}
Copy-Item $backup $target -Force
Write-Host "serve.mjs 已恢复为应用覆盖包前的版本。" -ForegroundColor Green
Write-Host "注意：覆盖包新增的 Docker/CI/scripts 文件不会自动删除。"
