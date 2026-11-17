# ==============================================================================
# QueueForge Development Environment Activation Script
# Usage: . .\env.ps1  (dot-source into current PowerShell session)
# ==============================================================================

Write-Host "Activating QueueForge Environment on D:..." -ForegroundColor Cyan

# 1. Java 21 Configuration (Eclipse Temurin JDK 21 on D:)
$env:JAVA_HOME = "D:\Development\tools\jdk-21"

# 2. Apache Maven Configuration (Maven 3.9 on D:)
$env:MAVEN_HOME = "D:\Development\tools\maven"
$env:M2_HOME = "D:\Development\tools\maven"

# 3. Path Prepend (Ensure D: tools take priority over C: Oracle Java / other tools)
$env:PATH = "D:\Development\tools\jdk-21\bin;D:\Development\tools\maven\bin;$env:PATH"

# 4. Redirect All Temporary Files to D:
$env:TEMP = "D:\Projects\QueueForge\temp"
$env:TMP = "D:\Projects\QueueForge\temp"
$env:TMPDIR = "D:\Projects\QueueForge\temp"

# 5. Maven Repository and JVM Temp Redirection
$env:MAVEN_OPTS = "-Xmx512m -Xms64m -Dmaven.repo.local=D:/Development/maven-repository -Djava.io.tmpdir=D:/Projects/QueueForge/temp"

# 6. NPM Cache & Prefix Redirection to D:
$env:npm_config_cache = "D:\Projects\QueueForge\.cache\npm"
$env:npm_config_prefix = "D:\Projects\QueueForge\.cache\npm-global"
$env:PLAYWRIGHT_BROWSERS_PATH = "D:\Projects\QueueForge\.cache\ms-playwright"

# 7. Safely load local .env variables (without hardcoding secrets into Git)
$dotenvPath = "D:\Projects\QueueForge\.env"
if (Test-Path $dotenvPath) {
    Get-Content $dotenvPath | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $varName = $parts[0].Trim()
            $varVal = $parts[1].Trim()
            [System.Environment]::SetEnvironmentVariable($varName, $varVal, "Process")
        }
    }
}

# Defaults if .env was not present
if (-not $env:DB_HOST) { $env:DB_HOST = "127.0.0.1" }
if (-not $env:DB_PORT) { $env:DB_PORT = "5435" }
if (-not $env:DB_NAME) { $env:DB_NAME = "queueforge" }
if (-not $env:DB_USERNAME) { $env:DB_USERNAME = "queueforge_app" }
if (-not $env:LOG_FILE) { $env:LOG_FILE = "D:\Projects\QueueForge\logs\queueforge.log" }

# 8. Output Diagnostics
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " QueueForge Session Activated Successfully (D: Isolated) " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "JAVA_HOME      : $env:JAVA_HOME"
Write-Host "MAVEN_HOME     : $env:MAVEN_HOME"
Write-Host "Maven Repo     : D:\Development\maven-repository"
Write-Host "Temp Directory : $env:TEMP"
Write-Host "NPM Cache      : $env:npm_config_cache"
Write-Host "PostgreSQL Host: ${env:DB_HOST}:${env:DB_PORT} (${env:DB_NAME})"
Write-Host "Database User  : $env:DB_USERNAME"
Write-Host "==========================================================" -ForegroundColor Green
