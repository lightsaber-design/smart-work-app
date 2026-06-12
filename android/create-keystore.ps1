# ─────────────────────────────────────────────────────────
# MinistryLog — script para crear keystore de release
#
# Ejecuta DESDE la carpeta android/:
#   cd android
#   .\create-keystore.ps1
#
# Guarda release-key.jks y release-signing.properties.
# NUNCA subas estos ficheros al repositorio (ya están en .gitignore).
# ─────────────────────────────────────────────────────────

$keystore   = "release-key.jks"
$alias      = "ministrylog"
$validity   = 10000   # días (~27 años)

Write-Host ""
Write-Host "=== Generador de keystore para MinistryLog ===" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $keystore) {
    Write-Host "AVISO: Ya existe $keystore. Si continúas se sobreescribirá." -ForegroundColor Yellow
    $confirm = Read-Host "¿Continuar? (s/N)"
    if ($confirm -notmatch "^[sS]$") { exit 0 }
}

$storePass = Read-Host "Contraseña del keystore (storePassword)"
$keyPass   = Read-Host "Contraseña de la clave   (keyPassword) — puede ser igual"

if ($storePass.Length -lt 6 -or $keyPass.Length -lt 6) {
    Write-Host "ERROR: las contraseñas deben tener al menos 6 caracteres." -ForegroundColor Red
    exit 1
}

# Buscar keytool (incluido con JDK / Android Studio)
$keytool = $null
$candidates = @(
    "$env:JAVA_HOME\bin\keytool.exe",
    "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe",
    "C:\Program Files\Java\jdk-17\bin\keytool.exe",
    "keytool"
)
foreach ($c in $candidates) {
    if (Get-Command $c -ErrorAction SilentlyContinue) { $keytool = $c; break }
}
if (-not $keytool) {
    Write-Host "ERROR: no se encontró keytool. Asegúrate de tener el JDK instalado." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Creando keystore (te pedirá nombre, organización, etc.)..." -ForegroundColor Green
& $keytool -genkey -v `
    -keystore $keystore `
    -alias $alias `
    -keyalg RSA -keysize 2048 `
    -validity $validity `
    -storepass $storePass `
    -keypass $keyPass

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: keytool falló con código $LASTEXITCODE." -ForegroundColor Red
    exit 1
}

# Escribir release-signing.properties
$propsContent = @"
storeFile=$keystore
storePassword=$storePass
keyAlias=$alias
keyPassword=$keyPass
"@
$propsContent | Out-File -FilePath "release-signing.properties" -Encoding utf8 -NoNewline

Write-Host ""
Write-Host "✓ Keystore creado:  android/$keystore" -ForegroundColor Green
Write-Host "✓ Propiedades:      android/release-signing.properties" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANTE: haz una copia de seguridad de $keystore y de tus contraseñas." -ForegroundColor Yellow
Write-Host "Si pierdes el keystore NO podrás publicar actualizaciones en Play Store." -ForegroundColor Yellow
Write-Host ""
