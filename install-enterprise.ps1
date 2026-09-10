$ErrorActionPreference = "Stop"

Write-Host "GeoOmni Enterprise Overlay" -ForegroundColor Cyan
Write-Host "1/4 检查 Node..."
node --version | Out-Host

Write-Host "2/4 应用 serve.mjs 企业工程化补丁..."
node tools/apply-enterprise-hardening.mjs

Write-Host "3/4 语法与静态审计..."
node --check serve.mjs
node scripts/static-audit.mjs

Write-Host "4/4 完成。" -ForegroundColor Green
Write-Host "本地启动: npm start"
Write-Host "启动后验收: npm run smoke"
Write-Host "Docker 启动: docker compose up -d --build"
Write-Host "Docker 入口: http://127.0.0.1:8080/chat-engine/chatting"
