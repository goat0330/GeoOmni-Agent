param(
    [switch]$Reset,
    [string]$Model
)

$ErrorActionPreference = "Stop"
$userScope = [EnvironmentVariableTarget]::User
$secretPtr = [IntPtr]::Zero
$apiKey = $null

try {
    $apiKey = [Environment]::GetEnvironmentVariable("DEEPSEEK_API_KEY", $userScope)
    if ($Reset -or [string]::IsNullOrWhiteSpace($apiKey)) {
        $secureKey = Read-Host "输入 DeepSeek API Key（不会回显）" -AsSecureString
        $secretPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
        $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPtr)
        if ([string]::IsNullOrWhiteSpace($apiKey)) {
            throw "API Key 不能为空。"
        }
        [Environment]::SetEnvironmentVariable("DEEPSEEK_API_KEY", $apiKey, $userScope)
        Write-Host "API Key 已保存到当前 Windows 用户环境变量。" -ForegroundColor DarkGray
    }

    if ([string]::IsNullOrWhiteSpace($Model)) {
        $Model = [Environment]::GetEnvironmentVariable("DEEPSEEK_MODEL", $userScope)
    }
    if ([string]::IsNullOrWhiteSpace($Model)) {
        $Model = "deepseek-v4-flash"
    }
    [Environment]::SetEnvironmentVariable("DEEPSEEK_MODEL", $Model.Trim(), $userScope)

    $baseUrl = [Environment]::GetEnvironmentVariable("DEEPSEEK_BASE_URL", $userScope)
    if ([string]::IsNullOrWhiteSpace($baseUrl)) {
        $baseUrl = "https://api.deepseek.com"
        [Environment]::SetEnvironmentVariable("DEEPSEEK_BASE_URL", $baseUrl, $userScope)
    }

    $env:DEEPSEEK_API_KEY = $apiKey
    $env:DEEPSEEK_MODEL = $Model.Trim()
    $env:DEEPSEEK_BASE_URL = $baseUrl.Trim()

    Write-Host "本地问答已接入 $($env:DEEPSEEK_MODEL)，启动地址：http://127.0.0.1:4173/chat-engine" -ForegroundColor Cyan
    node serve.mjs
}
finally {
    if ($secretPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPtr)
    }
    $apiKey = $null
}
